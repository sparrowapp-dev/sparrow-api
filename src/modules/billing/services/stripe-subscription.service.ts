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
import { ScheduledDowngradeDto } from "@src/modules/common/models/billing.model";
import { LicensesDto } from "@src/modules/common/models/licenses.model";

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
    @Optional() @Inject(StripeService) private readonly stripeService?: any,
  ) {}

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
          // Get plan limits for audit tracking
          let planLimits:
            | { previous: Record<string, any>; new: Record<string, any> }
            | undefined;

          if (currentTeam?.plan?.limits) {
            // Get the new plan details to access its limits
            const newPlanDetails =
              await this.stripeSubscriptionRepo.findPlanByName(
                metadata.planName,
              );
            if (newPlanDetails?.limits) {
              planLimits = {
                previous: currentTeam.plan.limits,
                new: newPlanDetails.limits,
              };
            }
          }

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
            undefined, // no seat change
            undefined, // no subscription details needed
            planLimits, // Add plan limits for automatic HUB_LIMIT_UPDATED tracking
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

    // Get plan limits for audit tracking
    let planLimits:
      | { previous: Record<string, any>; new: Record<string, any> }
      | undefined;

    if (currentTeam?.plan?.limits && communityPlan.limits) {
      planLimits = {
        previous: currentTeam.plan.limits,
        new: communityPlan.limits,
      };
    }

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
      undefined, // no seat change
      undefined, // no subscription details needed
      planLimits, // Add plan limits for automatic HUB_LIMIT_UPDATED tracking
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
      latest_invoice: invoice.id,
      seats: metadata?.userCount || 1,
      invoice_url: invoice.hosted_invoice_url,
      billing_reason: billingReason,
      current_period_start: periodDates.currentPeriodStart,
      current_period_end: periodDates.currentPeriodEnd,
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
      await this.downgradeToCommunityPlan(
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
  private async downgradeToCommunityPlan(
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

      // Get plan limits for audit tracking
      let planLimits:
        | { previous: Record<string, any>; new: Record<string, any> }
        | undefined;

      if (team?.plan?.limits && communityPlan.limits) {
        planLimits = {
          previous: team.plan.limits,
          new: communityPlan.limits,
        };
      }

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
        undefined, // no seat change
        undefined, // no subscription details needed
        planLimits, // Add plan limits for automatic HUB_LIMIT_UPDATED tracking
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
      latest_invoice: invoice.id,
      seats: metadata?.userCount || 1,
      invoice_url: invoice.hosted_invoice_url,
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

      // Get plan limits for audit tracking
      let planLimits:
        | { previous: Record<string, any>; new: Record<string, any> }
        | undefined;

      if (isPlanChange) {
        // Get the new plan details to access its limits
        const previousPlanDetails =
          await this.stripeSubscriptionRepo.findPlanByName(previousPlan);
        const newPlanDetails =
          await this.stripeSubscriptionRepo.findPlanByName(newPlan);
        if (newPlanDetails?.limits && previousPlanDetails?.limits) {
          planLimits = {
            previous: previousPlanDetails?.limits,
            new: newPlanDetails.limits,
          };
        }
      }

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
        planLimits, // Add the plan limits for automatic HUB_LIMIT_UPDATED tracking
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
      const scheduledDowngrade: ScheduledDowngradeDto = {
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
      const currentDate = new Date(Date.now() - 3 * 24 * 60 * 600 * 100); //3 days ago
      const teams =
        await this.stripeSubscriptionRepo.findTeamsWithExpiredFailedSubscriptions(
          currentDate,
        );

      for (const team of teams) {
        try {
          // Cancel Stripe subscription manually before downgrading
          if (this.stripeService && team.billing?.paymentProviders) {
            const subscriptionId = team.billing.paymentProviders?.find(
              (provider: any) => provider.provider === PaymentProvider.STRIPE,
            )?.subscriptionId;

            if (subscriptionId) {
              try {
                await this.stripeService.cancelSubscription(
                  subscriptionId,
                  true, // cancel immediately instead of at period end
                );
              } catch (stripeError) {
                console.error(
                  `Failed to cancel Stripe subscription ${subscriptionId} for team ${team._id}:`,
                  stripeError,
                );
                // Continue with downgrade even if Stripe cancellation fails
              }
            }
          }

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
            paymentProviders: team.billing?.paymentProviders || [],
            status: SubscriptionStatus.CANCELED,
            billingType: BillingType.EXPIRED_SUBSCRIPTION,
            canceled_at: new Date(),
            cancellation_reason: "payment_failed_period_expired",
            updatedBy: "system-maintenance-job",
          };

          // Update team to community plan
          await this.updateTeamPlanWithBilling(
            team._id.toString(),
            communityPlan,
            billingDetails,
          );

          // Send plan downgrade email notification
          if (this.paymentEmailHelper && team.plan?.name) {
            try {
              await this.paymentEmailHelper.sendDowngradedToCommunityEmail(
                team,
                team.plan.name, // Previous plan
              );
            } catch (error) {
              console.error(
                "Error sending downgraded to community email:",
                error,
              );
            }
          }

          // Get plan limits for audit tracking
          let planLimits:
            | { previous: Record<string, any>; new: Record<string, any> }
            | undefined;

          if (team?.plan?.limits && communityPlan.limits) {
            planLimits = {
              previous: team.plan.limits,
              new: communityPlan.limits,
            };
          }

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
            undefined, // no seat change
            undefined, // no subscription details needed
            planLimits, // Add plan limits for automatic HUB_LIMIT_UPDATED tracking
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
      const currentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); //3 days ago
      const teams =
        await this.stripeSubscriptionRepo.findTeamsWithExpiredTrials(
          currentDate,
        );

      for (const team of teams) {
        try {
          // Cancel Stripe subscription manually before downgrading for expired trials
          if (this.stripeService && team.billing?.paymentProviders) {
            const subscriptionId = team.billing.paymentProviders?.find(
              (provider: any) => provider.provider === PaymentProvider.STRIPE,
            )?.subscriptionId;

            if (subscriptionId) {
              try {
                await this.stripeService.cancelSubscription(
                  subscriptionId,
                  true, // cancel immediately instead of at period end
                );
              } catch (stripeError) {
                console.error(
                  `Failed to cancel Stripe subscription ${subscriptionId} for expired trial team ${team._id}:`,
                  stripeError,
                );
                // Continue with downgrade even if Stripe cancellation fails
              }
            }
          }

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
            paymentProviders: team.billing?.paymentProviders || [],
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

          // Send plan downgrade email notification
          if (this.paymentEmailHelper && team.plan?.name) {
            try {
              await this.paymentEmailHelper.sendDowngradedToCommunityEmail(
                team,
                team.plan.name, // Previous plan
              );
            } catch (error) {
              console.error(
                "Error sending downgraded to community email:",
                error,
              );
            }
          }

          // Get plan limits for audit tracking
          let planLimits:
            | { previous: Record<string, any>; new: Record<string, any> }
            | undefined;

          if (team?.plan?.limits && communityPlan.limits) {
            planLimits = {
              previous: team.plan.limits,
              new: communityPlan.limits,
            };
          }

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
            undefined, // no seat change
            undefined, // no subscription details needed
            planLimits, // Add plan limits for automatic HUB_LIMIT_UPDATED tracking
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
   * Send subscription expired emails immediately when subscriptions/trials expire
   * This method should be called by a scheduled job/cron - runs daily
   */
  async sendSubscriptionExpiredEmails(): Promise<void> {
    try {
      const currentDate = new Date();

      // Find teams with expired failed subscriptions and trials (current day)
      const expiredTeams =
        await this.stripeSubscriptionRepo.findTeamsWithExpiredBilling(
          currentDate,
        );

      for (const team of expiredTeams) {
        try {
          // Check if email was already sent
          if (team.billing?.subscription_expired_email_sent) {
            continue;
          }

          // Send subscription expired email
          await this.paymentEmailHelper.sendSubscriptionExpiredEmail(team);

          // Mark email as sent in billing object
          await this.stripeSubscriptionRepo.updateTeamById(
            team._id.toString(),
            {
              "billing.subscription_expired_email_sent": new Date(),
            },
          );
        } catch (error) {
          console.error(
            `Error sending subscription expired email for team ${team._id}:`,
            error,
          );
          // Continue with other teams even if one fails
        }
      }
    } catch (error) {
      console.error("Error sending subscription expired emails:", error);
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

  /**
   * Check available licenses and manage seat purchasing via Stripe
   * @param team The team data including billing information
   * @param userEmails Array of email addresses to be invited
   * @param userRepository User repository instance for checking existing users
   * @returns Result indicating success/failure and message
   */
  async checkAndManageLicenses(
    team: any,
    userEmails: string[],
    userRepository: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Skip license checking for community plan or if no billing info
      if (
        team.plan?.name === PlanName.COMMUNITY &&
        team?.billing?.status !== SubscriptionStatus.PAYMENT_FAILED
      ) {
        return { success: true, message: "No license checking required" };
      }

      if (!userRepository) {
        console.warn("UserRepository not provided to checkAndManageLicenses");
        return {
          success: false,
          message: "User repository is required for license checking",
        };
      }

      // Categorize users into existing/already invited and truly new users
      let newUsersCount = 0;
      let skippedUsersCount = 0;

      for (const userEmail of userEmails) {
        const sanitizedEmail = userEmail.trim().toLowerCase();

        // Check if user is already a team member
        const isTeamMember = team.users?.some(
          (user: any) => user.email === sanitizedEmail,
        );

        // Check if user already has a pending invite
        const hasPendingInvite = team.invites?.some(
          (invite: any) => invite.email === sanitizedEmail,
        );

        if (isTeamMember || hasPendingInvite) {
          // Skip users who are already team members or have pending invites
          skippedUsersCount++;
          continue;
        } else {
          // Completely new user - needs both invite and license
          newUsersCount++;
        }
      }

      // If all users are already members or have pending invites
      if (newUsersCount === 0 && skippedUsersCount > 0) {
        return {
          success: true,
          message: `All ${skippedUsersCount} users are already team members or have pending invites`,
        };
      }

      // Calculate current usage and available licenses
      const currentActiveUsers = Number(team.users?.length || 0);
      const currentPendingInvites = Number(
        team.invites?.filter((invite: any) => !invite.isAccepted).length || 0,
      );
      const totalCurrentUsage = currentActiveUsers + currentPendingInvites;

      // Get available licenses from license object or fallback to billing seats
      const availableLicenses = Number(
        team.licenses?.totalSeats || team.billing?.seats || 1,
      );
      const unusedLicenses = Math.max(0, availableLicenses - totalCurrentUsage);

      // Only check licenses for new users (not existing users)
      const usersRequiringLicenses = newUsersCount;

      // If we have enough unused licenses, proceed
      if (unusedLicenses >= usersRequiringLicenses) {
        const newUsedSeats = totalCurrentUsage + usersRequiringLicenses;
        const newTotalSeats = availableLicenses;

        const licenseData: LicensesDto = {
          totalSeats: newTotalSeats,
          usedSeats: newUsedSeats,
          availableSeats: newTotalSeats - newUsedSeats,
          lastUpdated: new Date(),
        };

        // Update team with new license data
        await this.stripeSubscriptionRepo.updateTeamById(String(team._id), {
          licenses: licenseData,
        });

        let message = `Using ${usersRequiringLicenses} of ${unusedLicenses} available licenses`;
        if (skippedUsersCount > 0) {
          message += ` (${skippedUsersCount} users already in team/invited)`;
        }

        return {
          success: true,
          message,
        };
      }

      // Check if scheduled downgrade is active - block invites during downgrade
      if (team.billing?.scheduledDowngrade) {
        return {
          success: false,
          message: "Invite blocked due to your scheduled downgrade.",
        };
      }

      // Check for payment failed status - block new purchases until resolved
      if (team.billing?.status === SubscriptionStatus.PAYMENT_FAILED) {
        return {
          success: false,
          message:
            "Invite failed. Please resolve your payment issue to send invites.",
        };
      }

      // Check for action required status - block new purchases until 3DS is completed
      if (team.billing?.status === SubscriptionStatus.ACTION_REQUIRED) {
        return {
          success: false,
          message:
            "Invite failed. Please complete payment authentication to send invites.",
        };
      }

      // Calculate additional seats needed (only for new users)
      const additionalSeatsNeeded = Math.max(
        0,
        usersRequiringLicenses - unusedLicenses,
      );
      const newTotalSeats = availableLicenses + additionalSeatsNeeded;

      // Check if Stripe service is available for purchasing additional seats
      if (!this.stripeService) {
        return {
          success: false,
          message:
            "Cannot purchase additional seats: Stripe service not available",
        };
      }

      // Check if team has active subscription
      if (
        !team.billing?.latest_invoice ||
        team.billing.status !== SubscriptionStatus.ACTIVE
      ) {
        return {
          success: false,
          message:
            "Cannot purchase additional seats: No active subscription found",
        };
      }

      // Get Stripe subscription ID
      const subscriptionId = team.billing.paymentProviders?.find(
        (provider: any) => provider.provider === PaymentProvider.STRIPE,
      )?.subscriptionId;

      if (!subscriptionId) {
        return {
          success: false,
          message:
            "Cannot purchase additional seats: No Stripe subscription ID found",
        };
      }

      try {
        // Update subscription with new seat count using allow_incomplete payment behavior
        const data = await this.stripeService.updateSubscription(
          subscriptionId,
          undefined, // no new price_id (we are updating seats)
          {
            hubId: String(team._id),
            userCount: String(newTotalSeats),
            planName: team.plan?.name,
            licenseUpdate: "true",
            previousSeats: String(availableLicenses),
            newSeats: String(newTotalSeats),
          },
          undefined, // default_payment_method (optional)
          "always_invoice", // prorationBehavior (optional)
          false, // atPeriodEnd (optional)
          newTotalSeats, // seats
          "allow_incomplete", // payment_behavior
          "unchanged", // billing cycle_anchor
        );

        // Handle 3DS authentication required
        if (data.requiresAction) {
          let invoice = null;
          const latest_invoice = data?.subscription?.latest_invoice;
          const invoices =
            await this.stripeService.getInvoiceById(latest_invoice);

          if (invoices?.hosted_invoice_url) {
            invoice = invoices.hosted_invoice_url;
          }

          const billingDetails = {
            ...team.billing,
            status: SubscriptionStatus.ACTION_REQUIRED,
            invoice_url: invoice,
          };

          // Update team billing status to indicate action required
          await this.updateTeamPlanWithBilling(
            String(team._id),
            team.plan,
            billingDetails,
          );

          return {
            success: false,
            message:
              "Invite failed. Please complete payment authentication to send invites.",
          };
        }

        // Payment succeeded - update licenses
        const futurePendingInvites = currentPendingInvites + newUsersCount;
        const futureTotalUsage = currentActiveUsers + futurePendingInvites;

        const licenseData: LicensesDto = {
          totalSeats: newTotalSeats,
          usedSeats: futureTotalUsage,
          availableSeats: newTotalSeats - futureTotalUsage,
          lastUpdated: new Date(),
        };

        // Update team with new license data
        await this.stripeSubscriptionRepo.updateTeamById(String(team._id), {
          licenses: licenseData,
        });

        return {
          success: true,
          message: `Successfully purchased ${additionalSeatsNeeded} additional seats. Total: ${newTotalSeats} seats`,
        };
      } catch (stripeError) {
        console.error("Error updating Stripe subscription:", stripeError);
        return {
          success: false,
          message: `Failed to purchase additional seats: ${
            stripeError.message || "Stripe API error"
          }`,
        };
      }
    } catch (error) {
      console.error("Error in license checking:", error);
      return {
        success: false,
        message: `License checking failed: ${error.message}`,
      };
    }
  }
}
