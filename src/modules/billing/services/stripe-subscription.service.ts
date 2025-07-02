import { Injectable, Inject, Optional } from "@nestjs/common";
import { StripeSubscriptionRepository } from "../repositories/stripe-subscription.repository";
import { BillingAuditService } from "./billing-audit.service";
import { PaymentEmailHelper } from "../helpers/payment-email.helper";
import { StripeSubscriptionHelpers } from "../helpers/stripe-subscription.helpers";
import {
  BillingType,
  PaymentProvider,
  SubscriptionStatus,
  BillingActorType,
  BillingSource,
} from "@src/modules/common/enum/billing.enum";
import { PlanName } from "@src/modules/common/enum/plan.enum";
import { TeamsPlan } from "@src/modules/common/models/team.model";

// Dynamically import Stripe service class
let StripeService: any;
try {
  const stripeBilling = require("@sparrowapp-dev/stripe-billing");
  StripeService = stripeBilling.StripeService;
} catch (error) {
  console.warn("Stripe service not available");
}

/**
 * Service for handling Stripe subscription operations
 */
@Injectable()
export class StripeSubscriptionService {
  constructor(
    private readonly stripeSubscriptionRepo: StripeSubscriptionRepository,
    private readonly billingAuditService: BillingAuditService,
    private readonly paymentEmailHelper: PaymentEmailHelper,
    @Optional() @Inject(StripeService) private readonly stripeService: any,
  ) {
    if (!this.stripeService) {
      console.warn(
        "Stripe service not available, some features will be limited",
      );
    }
  }

  /**
   * Handle subscription creation event
   * @param subscription The Stripe subscription object
   * @param eventId The Stripe event ID
   */
  async handleSubscriptionCreated(
    subscription: any,
    eventId?: string,
  ): Promise<void> {
    try {
      // Extract metadata and validate required fields
      const { isValid, metadata } = StripeSubscriptionHelpers.validateMetadata(
        subscription.metadata,
        ["planName", "hubId"],
      );

      // Create billing details object
      const billingDetails = StripeSubscriptionHelpers.extractBillingDetails(
        subscription,
        eventId,
      );

      if (!isValid) {
        return;
      }

      // Get current team state for comparison
      const currentTeam = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );
      const previousPlan = currentTeam?.plan?.name || null;

      // Log subscription creation regardless of status (including incomplete)
      await this.billingAuditService.recordSubscriptionCreated(
        metadata.hubId,
        metadata.planName,
        {
          id: subscription.id,
          status: billingDetails.status,
          seats: metadata?.userCount || 1,
          trial_end: subscription.trial_end,
          billing_cycle: billingDetails.current_period_end,
          current_period_start: billingDetails.current_period_start,
          current_period_end: billingDetails.current_period_end,
          interval: billingDetails.interval,
          interval_count: billingDetails.interval_count,
        },
        {
          actor: {
            type: BillingActorType.WEBHOOK,
            name: PaymentProvider.STRIPE,
          },
          source: BillingSource.STRIPE_WEBHOOK,
          externalId: eventId,
          reason: `Subscription created with status: ${subscription.status}`,
        },
      );

      // Only update team state if subscription is active
      if (subscription.status === SubscriptionStatus.ACTIVE) {
        await this.updateTeamAndWorkspacesWithPlan(
          metadata.hubId,
          metadata.planName,
          subscription,
          eventId,
        );

        // Log plan change if this is different from current plan
        if (previousPlan && previousPlan !== metadata.planName) {
          await this.billingAuditService.recordPlanChange(
            metadata.hubId,
            previousPlan,
            metadata.planName,
            {
              actor: {
                type: BillingActorType.WEBHOOK,
                name: PaymentProvider.STRIPE,
              },
              source: BillingSource.STRIPE_WEBHOOK,
              externalId: eventId,
              reason: "Plan upgraded via subscription creation",
            },
          );
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle subscription update event - process cancellations and payment failures
   * @param subscription The updated Stripe subscription object
   * @param eventId The Stripe event ID
   */
  async handleSubscriptionUpdated(
    subscription: any,
    eventId?: string,
  ): Promise<void> {
    try {
      // Extract metadata and validate required fields
      const { isValid, metadata } = StripeSubscriptionHelpers.validateMetadata(
        subscription.metadata,
        ["planName", "hubId"],
      );

      if (!isValid) {
        return;
      }

      // Process subscription cancellations
      if (subscription.status === SubscriptionStatus.CANCELED) {
        await this.handleSubscriptionCancellation(
          subscription,
          metadata,
          eventId,
        );
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle subscription cancellation logic
   * @param subscription The canceled subscription object
   * @param metadata The subscription metadata
   * @param eventId The Stripe event ID
   */
  private async handleSubscriptionCancellation(
    subscription: any,
    metadata: any,
    eventId?: string,
  ): Promise<void> {
    // Get current team state
    const currentTeam = await this.stripeSubscriptionRepo.findTeamById(
      metadata.hubId,
    );
    const previousPlan = currentTeam?.plan?.name || "unknown";

    // Find the community plan for downgrade
    const communityPlan = await this.stripeSubscriptionRepo.findPlanByName(
      PlanName.COMMUNITY,
    );
    if (!communityPlan) {
      console.error("Community plan not found");
      return;
    }

    // Ensure the community plan has an ID for the update
    communityPlan.id = communityPlan._id;
    delete communityPlan._id;

    // Get cancellation reason if available
    const cancellationReason =
      subscription.cancellation_details?.reason || "unknown";

    // Update billing details for canceled subscription
    const billingDetails = {
      ...StripeSubscriptionHelpers.extractBillingDetails(subscription),
      status: SubscriptionStatus.CANCELED,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : new Date(),
      cancellation_reason: cancellationReason,
      seats: metadata?.userCount || 1,
      updatedBy: BillingSource.STRIPE_WEBHOOK,
      event_id: eventId,
    };

    // Update team to community plan with canceled billing status
    await this.updateTeamPlanWithBilling(
      metadata.hubId,
      communityPlan,
      billingDetails,
    );

    // Log plan change event
    await this.billingAuditService.recordPlanChange(
      metadata.hubId,
      previousPlan,
      PlanName.COMMUNITY,
      {
        actor: { type: BillingActorType.WEBHOOK, name: PaymentProvider.STRIPE },
        source: BillingSource.STRIPE_WEBHOOK,
        externalId: eventId,
        reason: `Subscription canceled - ${cancellationReason}`,
      },
    );
  }

  /**
   * Handle invoice payment failed event
   * @param invoice The failed invoice object from Stripe
   * @param eventId The Stripe event ID
   */
  async handleInvoicePaymentFailed(
    invoice: any,
    eventId?: string,
  ): Promise<void> {
    try {
      // Extract subscription ID and metadata
      const { subscriptionId, metadata } =
        StripeSubscriptionHelpers.extractInvoiceData(invoice);

      if (!subscriptionId || !metadata.hubId) {
        return;
      }

      // Check if team exists and get current subscription status
      const team = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );

      if (!team) {
        return;
      }

      // Check if subscription is already in a terminal state
      if (team.billing && team.billing.status) {
        if (StripeSubscriptionHelpers.isTerminalStatus(team.billing.status)) {
          console.log(
            `Subscription already in terminal state: ${team.billing.status}`,
          );
          return;
        }
      }

      await this.processPaymentFailure(invoice, team, metadata, eventId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process payment failure based on billing reason
   * @param invoice The failed invoice
   * @param team The team data
   * @param metadata The invoice metadata
   * @param eventId The Stripe event ID
   */
  private async processPaymentFailure(
    invoice: any,
    team: any,
    metadata: any,
    eventId?: string,
  ): Promise<void> {
    const billingReason = invoice.billing_reason || "unknown";
    const amount = invoice.amount_due ? invoice.amount_due / 100 : 0;
    const { subscriptionId } =
      StripeSubscriptionHelpers.extractInvoiceData(invoice);

    // Extract current period dates from the invoice or existing billing record
    const periodDates = this.extractPeriodDates(invoice, team);
    const { isFirstPayment, isUpgradeFailure, isRenewalFailure } =
      StripeSubscriptionHelpers.determinePaymentFailureType(billingReason);

    // Create billing details object with failed payment status
    const billingDetails = {
      status: SubscriptionStatus.PAYMENT_FAILED,
      collection_method: invoice.collection_method,
      latest_invoice: invoice.id,
      seats: metadata?.userCount || 1,
      failed_invoice_url: invoice.hosted_invoice_url,
      next_payment_attempt: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000)
        : null,
      attempt_count: invoice.attempt_count,
      billing_reason: billingReason,
      current_period_start: periodDates.currentPeriodStart,
      current_period_end: periodDates.currentPeriodEnd,
      requires_action_at_period_end:
        billingReason === "subscription_update" ||
        billingReason === "subscription_cycle",
      failed_at: new Date(),
      updatedBy: BillingSource.STRIPE_WEBHOOK,
      event_id: eventId,
      paymentProviders: StripeSubscriptionHelpers.createOrUpdatePaymentProvider(
        team.billing?.paymentProviders || [],
        PaymentProvider.STRIPE,
        {
          payment_method: invoice?.payment_settings?.payment_method_types,
          subscriptionId: subscriptionId,
          customerId: invoice.customer,
        },
        true,
      ),
    };

    // Handle different failure scenarios
    if (isRenewalFailure || isUpgradeFailure) {
      // Keep current plan, just update billing status
      await this.updateTeamPlanWithBilling(
        metadata.hubId,
        team.plan,
        billingDetails,
      );
    } else if (isFirstPayment) {
      // Downgrade to Community plan for first payment failures
      await this.downgradeToCommuityPlan(
        metadata.hubId,
        team,
        billingDetails,
        eventId,
      );
    } else {
      // For other types of payment failures, just update the billing status
      await this.updateTeamPlanWithBilling(
        metadata.hubId,
        team.plan,
        billingDetails,
      );
    }

    // Log payment failure event
    await this.billingAuditService.recordPaymentEvent(
      metadata.hubId,
      false, // payment failed
      amount,
      invoice.currency || "usd",
      {
        actor: { type: BillingActorType.WEBHOOK, name: PaymentProvider.STRIPE },
        source: BillingSource.STRIPE_WEBHOOK,
        externalId: eventId,
        reason: `Payment failed - ${billingReason}`,
      },
      {
        invoiceId: invoice.id,
        subscriptionId,
        attemptCount: invoice.attempt_count,
        billingReason,
      },
    );
  }

  /**
   * Extract period dates from invoice or team billing data
   * @param invoice The invoice object
   * @param team The team data
   * @returns Object with current period start and end dates
   */
  private extractPeriodDates(
    invoice: any,
    team: any,
  ): {
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  } {
    let currentPeriodStart = null;
    let currentPeriodEnd = null;

    if (invoice.lines?.data?.[0]?.period) {
      currentPeriodStart = invoice.lines.data[0].period.start
        ? new Date(invoice.lines.data[0].period.start * 1000)
        : null;
      currentPeriodEnd = invoice.lines.data[0].period.end
        ? new Date(invoice.lines.data[0].period.end * 1000)
        : null;
    }

    if (!currentPeriodStart && team.billing?.current_period_start) {
      currentPeriodStart = team.billing.current_period_start;
    }

    if (!currentPeriodEnd && team.billing?.current_period_end) {
      currentPeriodEnd = team.billing.current_period_end;
    }

    return { currentPeriodStart, currentPeriodEnd };
  }

  /**
   * Downgrade team to community plan
   * @param hubId The team hub ID
   * @param team The team data
   * @param billingDetails The billing details
   * @param eventId The event ID
   */
  private async downgradeToCommuityPlan(
    hubId: string,
    team: any,
    billingDetails: any,
    eventId?: string,
  ): Promise<void> {
    const communityPlan = await this.stripeSubscriptionRepo.findPlanByName(
      PlanName.COMMUNITY,
    );
    if (communityPlan) {
      communityPlan.id = communityPlan._id;
      delete communityPlan._id;

      await this.updateTeamPlanWithBilling(
        hubId,
        communityPlan,
        billingDetails,
      );

      // Log plan change due to payment failure
      await this.billingAuditService.recordPlanChange(
        hubId,
        team.plan?.name || "unknown",
        PlanName.COMMUNITY,
        {
          actor: {
            type: BillingActorType.WEBHOOK,
            name: PaymentProvider.STRIPE,
          },
          source: BillingSource.STRIPE_WEBHOOK,
          externalId: eventId,
          reason: `First payment failed - downgraded to community`,
        },
      );
    }
  }

  /**
   * Handle invoice paid event
   * @param invoice The paid invoice object from Stripe
   * @param eventId The Stripe event ID
   */
  async handleInvoicePaid(invoice: any, eventId?: string): Promise<void> {
    try {
      // Extract subscription ID and metadata
      const { subscriptionId, metadata } =
        StripeSubscriptionHelpers.extractInvoiceData(invoice);

      if (!subscriptionId || !metadata.planName || !metadata.hubId) {
        return;
      }

      // Find the plan by name
      const plan = await this.stripeSubscriptionRepo.findPlanByName(
        metadata.planName,
      );
      if (!plan) {
        console.error(`Plan not found with name: ${metadata.planName}`);
        return;
      }

      // Ensure the plan has an ID for the update
      plan.id = plan._id;
      delete plan._id;

      // Check if team exists and get current state for comparison
      const team = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );
      if (!team) {
        console.error(`Team not found with ID: ${metadata.hubId}`);
        return;
      }

      await this.processSuccessfulPayment(
        invoice,
        plan,
        team,
        metadata,
        eventId,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process successful payment and update team billing
   * @param invoice The paid invoice
   * @param plan The plan object
   * @param team The team data
   * @param metadata The invoice metadata
   * @param eventId The event ID
   */
  private async processSuccessfulPayment(
    invoice: any,
    plan: any,
    team: any,
    metadata: any,
    eventId?: string,
  ): Promise<void> {
    const { subscriptionId } =
      StripeSubscriptionHelpers.extractInvoiceData(invoice);
    const trialEndDateStr = metadata?.trial_end_date;
    const isTrialOngoing =
      trialEndDateStr && new Date(trialEndDateStr).getTime() > Date.now();

    // Find valid line item
    let validLineItem = null;
    if (!isTrialOngoing) {
      validLineItem = invoice.lines?.data?.find((item: any) => item.amount > 0);
    } else {
      validLineItem = invoice.lines?.data[0];
    }

    if (!validLineItem?.period) {
      console.warn(
        `No valid line item with amount > 0 found in invoice ${invoice.id}`,
      );
      return;
    }

    const period = validLineItem?.period;
    const amount = invoice.amount_paid ? invoice.amount_paid / 100 : 0;

    // Calculate billing cycle from period dates
    const periodStart = new Date(period.start * 1000);
    const periodEnd = new Date(period.end * 1000);
    const { billingCycle, intervalCount, interval } =
      StripeSubscriptionHelpers.calculateBillingCycle(periodStart, periodEnd);

    // Get previous billing state for comparison
    const previousPlan = team.plan?.name;
    const newPlan = metadata.planName;
    const previousSeats = team.billing?.seats?.toString() || "1";
    const newSeats = (metadata?.userCount || 1).toString();

    // Calculate previous interval from billing period dates
    const previousInterval = this.calculateIntervalFromPeriod(
      team.billing?.current_period_start,
      team.billing?.current_period_end,
    );

    const previousPeriodStart = team.billing?.current_period_start;
    const previousPeriodEnd = team.billing?.current_period_end;

    const isPlanChange =
      previousPlan &&
      (previousPlan !== newPlan || previousInterval !== interval);
    const isSeatChange = previousSeats !== newSeats;
    const isSubscriptionRenewal =
      !isPlanChange && !isSeatChange && previousPeriodEnd;

    // Create billing details object with successful payment status
    const billingDetails = {
      current_period_start: period.start
        ? new Date(period.start * 1000)
        : new Date(),
      current_period_end: period.end ? new Date(period.end * 1000) : null,
      amount_billed: amount,
      currency: invoice.currency,
      status: SubscriptionStatus.ACTIVE,
      collection_method: invoice.collection_method,
      latest_invoice: invoice.id,
      seats: metadata?.userCount || 1,
      invoice_url: invoice.hosted_invoice_url,
      paid_at: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : new Date(),
      billingType: StripeSubscriptionHelpers.determineBillingType(
        {
          status: SubscriptionStatus.ACTIVE,
          discount: null,
          metadata: metadata,
        },
        metadata,
      ),
      updatedBy: BillingSource.STRIPE_WEBHOOK,
      in_trial: isTrialOngoing || false,
      event_id: eventId,
      paymentProviders: StripeSubscriptionHelpers.createOrUpdatePaymentProvider(
        team.billing?.paymentProviders || [],
        PaymentProvider.STRIPE,
        {
          subscriptionId: subscriptionId,
          payment_method: invoice?.payment_settings?.payment_method_types,
          customerId: invoice?.customer,
        },
        true,
      ),
    };

    await this.updateTeamPlanWithBilling(metadata.hubId, plan, billingDetails);

    // Log appropriate events based on payment type
    await this.logPaymentEvents(
      metadata.hubId,
      isPlanChange,
      isSeatChange,
      isSubscriptionRenewal,
      previousPlan,
      newPlan,
      previousSeats,
      newSeats,
      period,
      interval,
      intervalCount,
      amount,
      invoice,
      subscriptionId,
      previousPeriodStart,
      previousPeriodEnd,
      eventId,
    );
  }

  /**
   * Log payment-related events (plan changes, renewals, payments)
   */
  private async logPaymentEvents(
    hubId: string,
    isPlanChange: boolean,
    isSeatChange: boolean,
    isSubscriptionRenewal: boolean,
    previousPlan: string,
    newPlan: string,
    previousSeats: string,
    newSeats: string,
    period: any,
    interval: string,
    intervalCount: number,
    amount: number,
    invoice: any,
    subscriptionId: string,
    previousPeriodStart: Date,
    previousPeriodEnd: Date,
    eventId?: string,
  ): Promise<void> {
    // Log plan change if this is an upgrade/downgrade
    if (isPlanChange || isSeatChange) {
      // Get team data for email
      const team = await this.stripeSubscriptionRepo.findTeamById(hubId);
      const { metadata } =
        StripeSubscriptionHelpers.extractInvoiceData(invoice);

      await this.billingAuditService.recordPlanChange(
        hubId,
        previousPlan || "unknown",
        newPlan,
        {
          actor: {
            type: BillingActorType.WEBHOOK,
            name: PaymentProvider.STRIPE,
          },
          source: BillingSource.STRIPE_WEBHOOK,
          externalId: eventId,
          reason: `Plan change via successful payment - ${isPlanChange ? "plan" : ""}${isPlanChange && isSeatChange ? " and " : ""}${isSeatChange ? "seats" : ""} changed`,
        },
        isSeatChange ? { from: previousSeats, to: newSeats } : undefined,
        {
          current_period_start: period.start,
          current_period_end: period.end,
          interval: interval,
          interval_count: intervalCount,
        },
      );

      // Send plan upgrade email if this is a plan change (not just seat change)
      if (isPlanChange && team && this.paymentEmailHelper) {
        try {
          await this.paymentEmailHelper.sendPlanUpgradedEmail(
            invoice,
            team,
            metadata,
            previousPlan,
            newPlan,
            interval,
          );
        } catch (error) {
          console.error("Error sending plan upgrade email:", error);
        }
      }
    }

    // Log subscription renewal if this is a regular billing cycle renewal
    if (isSubscriptionRenewal) {
      await this.billingAuditService.recordSubscriptionRenewal(
        hubId,
        newPlan,
        {
          subscriptionId: subscriptionId,
          seats: parseInt(newSeats),
          previous_period_start: previousPeriodStart,
          previous_period_end: previousPeriodEnd,
          current_period_start: period.start,
          current_period_end: period.end,
          interval: interval,
          interval_count: intervalCount,
          amount_billed: amount,
          currency: invoice.currency,
        },
        {
          actor: {
            type: BillingActorType.WEBHOOK,
            name: PaymentProvider.STRIPE,
          },
          source: BillingSource.STRIPE_WEBHOOK,
          externalId: eventId,
          reason: "Subscription renewed for next billing cycle",
        },
      );
    }

    // Log successful payment event
    await this.billingAuditService.recordPaymentEvent(
      hubId,
      true, // payment succeeded
      amount,
      invoice.currency || "usd",
      {
        actor: { type: BillingActorType.WEBHOOK, name: PaymentProvider.STRIPE },
        source: BillingSource.STRIPE_WEBHOOK,
        externalId: eventId,
        reason: "Payment succeeded",
      },
      {
        invoiceId: invoice.id,
        subscriptionId,
        planName: newPlan,
      },
    );
  }

  /**
   * Handle invoice voided event
   * @param invoice The voided invoice object from Stripe
   * @param eventId The Stripe event ID
   */
  async handleInvoiceVoided(invoice: any, eventId?: string): Promise<void> {
    try {
      // Extract metadata
      const { metadata } = this.extractInvoiceData(invoice);

      if (!metadata.hubId) {
        return;
      }

      // Update team billing status to reflect that the invoice is no longer pending
      const team = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );
      if (!team) {
        return;
      }

      // Only update if the team has a billing record and the voided invoice is the latest one
      if (team.billing && team.billing.latest_invoice === invoice.id) {
        const communityPlan = await this.stripeSubscriptionRepo.findPlanByName(
          PlanName.COMMUNITY,
        );
        if (!communityPlan) {
          return;
        }

        // Ensure the community plan has an ID for the update
        communityPlan.id = communityPlan._id;
        delete communityPlan._id;

        const updatedBilling = {
          ...team.billing,
          status: SubscriptionStatus.VOIDED,
          invoice_voided: true,
          voided_at: new Date(),
          updatedBy: BillingSource.STRIPE_WEBHOOK,
          event_id: eventId,
        };

        await this.updateTeamPlanWithBilling(
          metadata.hubId,
          communityPlan,
          updatedBilling,
        );
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle subscription deletion event
   * @param subscription The deleted Stripe subscription object
   * @param eventId The Stripe event ID
   */
  async handleSubscriptionDeleted(
    subscription: any,
    eventId?: string,
  ): Promise<void> {
    try {
      // Extract metadata and validate required fields
      const { isValid, metadata } = this.validateMetadata(
        subscription.metadata,
        ["hubId"],
      );

      if (!isValid) {
        return;
      }

      // Void any open invoices associated with this subscription
      if (this.stripeService && subscription.latest_invoice) {
        try {
          await this.stripeService.voidInvoice(subscription.latest_invoice);
        } catch (invoiceError) {
          console.error(
            `Failed to void invoice ${subscription.latest_invoice}:`,
            invoiceError,
          );
        }
      }

      // Find the community plan for downgrade
      const communityPlan = await this.stripeSubscriptionRepo.findPlanByName(
        PlanName.COMMUNITY,
      );
      if (!communityPlan) {
        return;
      }

      communityPlan.id = communityPlan._id;
      delete communityPlan._id;

      // Get current team state for the previous plan name
      const team = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );
      const previousPlan = team?.plan?.name || "unknown";

      // Get cancellation reason if available
      const cancellationReason =
        subscription.cancellation_details?.reason || "unknown";

      // Update billing details for deleted subscription
      const billingDetails = {
        ...this.extractBillingDetails(subscription),
        status: SubscriptionStatus.DELETED,
        deleted_at: new Date(),
        ended_at: subscription.ended_at
          ? new Date(subscription.ended_at * 1000)
          : new Date(),
        in_trial: false,
        seats: metadata?.userCount || 1,
        cancellation_reason: cancellationReason,
        updatedBy: BillingSource.STRIPE_WEBHOOK,
        event_id: eventId,
      };

      // Update team to community plan with deleted billing status
      await this.updateTeamPlanWithBilling(
        metadata.hubId,
        communityPlan,
        billingDetails,
      );

      // Record subscription canceled event
      await this.billingAuditService.recordSubscriptionCanceled(
        metadata.hubId,
        previousPlan,
        {
          ...billingDetails,
          subscriptionId: subscription.id,
          status: SubscriptionStatus.DELETED,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          canceled_at: new Date(),
          ended_at: subscription.ended_at,
          cancellation_reason: cancellationReason,
        },
        {
          actor: {
            type: BillingActorType.WEBHOOK,
            name: PaymentProvider.STRIPE,
          },
          source: BillingSource.STRIPE_WEBHOOK,
          externalId: eventId,
          reason: `Subscription deleted - ${cancellationReason}`,
        },
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update team plan with billing details
   * @param hubId The team/hub ID
   * @param planData The plan data to update
   * @param billingDetails The billing details to set
   * @returns The update result
   */
  async updateTeamPlanWithBilling(
    hubId: string,
    planData: TeamsPlan,
    billingDetails: any,
  ): Promise<any> {
    return await this.stripeSubscriptionRepo.updateTeamPlan(hubId, planData, {
      billing: billingDetails,
    });
  }

  /**
   * Update team and workspaces with new plan
   * @param hubId The team/hub ID
   * @param planName The plan name
   * @param subscription The subscription object
   * @param eventId The event ID
   */
  async updateTeamAndWorkspacesWithPlan(
    hubId: string,
    planName: string,
    subscription: any,
    eventId?: string,
  ): Promise<void> {
    // Find the plan by name
    const plan = await this.stripeSubscriptionRepo.findPlanByName(planName);
    if (!plan) {
      console.error(`Plan not found with name: ${planName}`);
      return;
    }

    // Ensure the plan has an ID for the update
    plan.id = plan._id;
    delete plan._id;

    // Extract billing details
    const billingDetails = this.extractBillingDetails(subscription, eventId);

    // Update team plan with billing details
    await this.updateTeamPlanWithBilling(hubId, plan, billingDetails);
  }

  /**
   * Handle subscription schedule updated event
   * @param subscriptionSchedule The updated Stripe subscription schedule object
   * @param eventId The Stripe event ID
   */
  async handleSubscriptionScheduleUpdated(
    subscriptionSchedule: any,
    eventId?: string,
  ): Promise<void> {
    try {
      // Find metadata in the phases - look for scheduled downgrade information
      let scheduledDowngradeMetadata = null;
      let targetPlanName = null;
      let startDate = null;

      // Check phases for scheduled downgrade metadata
      if (
        subscriptionSchedule.phases &&
        subscriptionSchedule.phases.length > 0
      ) {
        for (const phase of subscriptionSchedule.phases) {
          if (phase.metadata && phase.metadata.scheduled_downgrade === "true") {
            scheduledDowngradeMetadata = phase.metadata;
            targetPlanName =
              phase.metadata.planName || phase.metadata.new_price_id;
            startDate = phase.start_date
              ? new Date(phase.start_date * 1000)
              : null;
            break;
          }
        }
      }

      if (!scheduledDowngradeMetadata) return;

      const hubId = scheduledDowngradeMetadata.hubId;
      if (!hubId) return;

      const team = await this.stripeSubscriptionRepo.findTeamById(hubId);
      if (!team) return;

      const currentBilling = team.billing || {};
      const scheduledDowngrade = {
        isScheduledDowngrade: true,
        startDate: startDate,
        planName: targetPlanName,
        scheduleId: subscriptionSchedule.id,
        originalSubscription: scheduledDowngradeMetadata.original_subscription,
        downgradeAtPeriodEnd:
          scheduledDowngradeMetadata.downgrade_at_period_end === "true",
        userCount: scheduledDowngradeMetadata.userCount,
        scheduledAt: new Date(),
        updatedBy: "system-stripe-webhook",
      };

      const updatedBilling = {
        ...currentBilling,
        scheduledDowngrade: scheduledDowngrade,
        updatedBy: "system-stripe-webhook",
      };

      await this.stripeSubscriptionRepo.updateTeamPlan(hubId, team.plan, {
        billing: updatedBilling,
      });

      // Send plan downgrade email notification
      if (this.paymentEmailHelper && targetPlanName && team.plan?.name) {
        try {
          await this.paymentEmailHelper.sendPlanDowngradedEmail(
            team,
            startDate,
            team.plan.name, // Previous plan
            targetPlanName, // New plan
          );
        } catch (error) {
          console.error("Error sending plan downgrade email:", error);
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check for subscriptions that need action at the end of their billing cycles
   * This method should be called by a scheduled job/cron
   */
  async checkSubscriptionsRequiringEndOfCycleAction(): Promise<void> {
    try {
      const currentDate = new Date();
      const teams =
        await this.stripeSubscriptionRepo.findTeamsWithExpiredFailedSubscriptions(
          currentDate,
        );

      for (const team of teams) {
        try {
          // Find the community plan for downgrade
          const communityPlan =
            await this.stripeSubscriptionRepo.findPlanByName(
              PlanName.COMMUNITY,
            );
          if (!communityPlan) {
            console.error("Community plan not found");
            continue;
          }

          // Ensure the plan has an ID for the update
          communityPlan.id = communityPlan._id;
          delete communityPlan._id;

          // Update billing details for expired subscription
          const billingDetails = {
            ...team.billing,
            status: SubscriptionStatus.CANCELED,
            canceled_at: new Date(),
            cancellation_reason: "payment_failed_period_expired",
            requires_action_at_period_end: false,
            updatedBy: "system-maintenance-job",
          };

          // Update team to community plan
          await this.updateTeamPlanWithBilling(
            team._id.toString(),
            communityPlan,
            billingDetails,
          );

          // Log the plan change
          await this.billingAuditService.recordPlanChange(
            team._id.toString(),
            team.plan?.name || "unknown",
            PlanName.COMMUNITY,
            {
              actor: { type: BillingActorType.SYSTEM, name: "maintenance-job" },
              source: BillingSource.BILLING_MAINTENANCE,
              reason: "Payment failed subscription expired at period end",
            },
          );

          console.log(
            `Downgraded team ${team._id} to community plan due to expired payment failure`,
          );
        } catch (error) {
          console.error(
            `Error processing expired subscription for team ${team._id}:`,
            error,
          );
        }
      }
    } catch (error) {
      console.error(
        "Error checking subscriptions requiring end-of-cycle action:",
        error,
      );
      throw error;
    }
  }

  /**
   * Check for expired trials and revert them to community plan
   * This method should be called by a scheduled job/cron
   */
  async checkAndRevertExpiredTrials(): Promise<void> {
    try {
      const currentDate = new Date();
      const teams =
        await this.stripeSubscriptionRepo.findTeamsWithExpiredTrials(
          currentDate,
        );

      for (const team of teams) {
        try {
          // Find the community plan for downgrade
          const communityPlan =
            await this.stripeSubscriptionRepo.findPlanByName(
              PlanName.COMMUNITY,
            );
          if (!communityPlan) {
            console.error("Community plan not found");
            continue;
          }

          // Ensure the plan has an ID for the update
          communityPlan.id = communityPlan._id;
          delete communityPlan._id;

          // Update billing details for expired trial
          const billingDetails = {
            ...team.billing,
            status: SubscriptionStatus.CANCELED,
            billingType: BillingType.EXPIRED_TRIAL,
            canceled_at: new Date(),
            cancellation_reason: "trial_expired",
            trial_expired: true,
            updatedBy: "system-maintenance-job",
          };

          // Update team to community plan
          await this.updateTeamPlanWithBilling(
            team._id.toString(),
            communityPlan,
            billingDetails,
          );

          // Log the plan change
          await this.billingAuditService.recordPlanChange(
            team._id.toString(),
            team.plan?.name || "unknown",
            PlanName.COMMUNITY,
            {
              actor: { type: BillingActorType.SYSTEM, name: "maintenance-job" },
              source: BillingSource.BILLING_MAINTENANCE,
              reason: "Trial period expired",
            },
          );

          console.log(
            `Reverted team ${team._id} to community plan due to expired trial`,
          );
        } catch (error) {
          console.error(
            `Error processing expired trial for team ${team._id}:`,
            error,
          );
        }
      }
    } catch (error) {
      console.error("Error checking and reverting expired trials:", error);
      throw error;
    }
  }

  /**
   * Extract billing details from a subscription object
   * @param subscription The Stripe subscription object
   * @param eventId Optional Stripe event ID for tracking
   * @returns Object containing relevant billing details
   */
  private extractBillingDetails(subscription: any, eventId?: string): any {
    return StripeSubscriptionHelpers.extractBillingDetails(
      subscription,
      eventId,
    );
  }

  /**
   * Validate metadata to ensure required fields are present
   * @param metadata The metadata object to validate
   * @param requiredFields Array of required field names
   * @returns Object with isValid flag and the metadata
   */
  private validateMetadata(
    metadata: any,
    requiredFields: string[],
  ): { isValid: boolean; metadata: any } {
    return StripeSubscriptionHelpers.validateMetadata(metadata, requiredFields);
  }

  /**
   * Extract metadata from an invoice, checking multiple potential locations
   * @param invoice The invoice object from Stripe
   * @returns Object containing subscriptionId and metadata
   */
  private extractInvoiceData(invoice: any): {
    subscriptionId: string | null;
    metadata: any;
  } {
    return StripeSubscriptionHelpers.extractInvoiceData(invoice);
  }

  /**
   * Calculate the billing interval from the current_period_start and current_period_end dates
   * @param currentPeriodStart The start date of the current period
   * @param currentPeriodEnd The end date of the current period
   * @returns The billing interval (e.g., "month", "year")
   */
  private calculateIntervalFromPeriod(
    currentPeriodStart?: Date,
    currentPeriodEnd?: Date,
  ): string {
    if (!currentPeriodStart || !currentPeriodEnd) {
      return "month";
    }

    const diffInMilliseconds = Math.abs(
      currentPeriodEnd.getTime() - currentPeriodStart.getTime(),
    );
    const diffInDays = Math.ceil(diffInMilliseconds / (1000 * 60 * 60 * 24));

    // Determine billing interval based on the number of days in the period
    if (diffInDays >= 335) {
      return "year";
    } else if (diffInDays >= 28 && diffInDays <= 31) {
      return "month";
    } else {
      return "month";
    }
  }
}
