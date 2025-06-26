import {
  Injectable,
  NotFoundException,
  Inject,
  Optional,
} from "@nestjs/common";
import { StripeSubscriptionRepository } from "../repositories/stripe-subscription.repository";
import {
  PaymentProvider,
  BillingType,
  SubscriptionStatus,
} from "@src/modules/common/enum/billing.enum";
import { PlanName } from "@src/modules/common/enum/plan.enum";
import { v4 as uuidv4 } from "uuid";
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
   */
  async handleSubscriptionCreated(subscription: any): Promise<void> {
    try {
      // Extract metadata and validate required fields
      const { isValid, metadata } = this.validateMetadata(
        subscription.metadata,
        ["planName", "hubId"],
      );

      if (!isValid) {
        return;
      }

      // Check subscription status - only process active subscriptions
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        return;
      }

      await this.updateTeamAndWorkspacesWithPlan(
        metadata.hubId,
        metadata.planName,
        subscription,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle subscription update event - process cancellations and payment failures
   * @param subscription The updated Stripe subscription object
   */
  async handleSubscriptionUpdated(subscription: any): Promise<void> {
    try {
      // Extract metadata and validate required fields
      const { isValid, metadata } = this.validateMetadata(
        subscription.metadata,
        ["planName", "hubId"],
      );

      if (!isValid) {
        return;
      }

      // Process subscription cancellations
      if (subscription.status === SubscriptionStatus.CANCELED) {
        // Find the community plan for downgrade
        const communityPlan = await this.stripeSubscriptionRepo.findPlanByName(
          PlanName.COMMUNITY,
        );
        if (!communityPlan) {
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
          ...this.extractBillingDetails(subscription),
          status: SubscriptionStatus.CANCELED,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : new Date(),
          cancellation_reason: cancellationReason,
          seats: metadata?.userCount || 1,
          updatedBy: "system-stripe-webhook",
        };

        // Update team to community plan with canceled billing status
        await this.updateTeamPlanWithBilling(
          metadata.hubId,
          communityPlan,
          billingDetails,
        );
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle invoice payment failed event
   * @param invoice The failed invoice object from Stripe
   */
  async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    try {
      // Extract subscription ID and metadata
      const { subscriptionId, metadata } = this.extractInvoiceData(invoice);

      if (!subscriptionId) {
        return;
      }

      if (!metadata.hubId) {
        return;
      }

      // Check if team exists and get current subscription status
      const team = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );

      if (!team) {
        return;
      }

      // Check if subscription is already in a terminal state (cancelled or deleted)
      // This prevents race conditions with subscription.deleted events
      if (team.billing && team.billing.status) {
        if (
          [SubscriptionStatus.CANCELED, SubscriptionStatus.DELETED].includes(
            team.billing.status,
          )
        ) {
          return;
        }
      }

      // Determine the billing reason to handle the case properly
      const billingReason = invoice.billing_reason || "unknown";

      // Extract current period dates from the invoice or the existing billing record
      let currentPeriodStart = null;
      let currentPeriodEnd = null;

      // Try to get period information from the invoice line items
      if (invoice.lines?.data?.[0]?.period) {
        currentPeriodStart = invoice.lines.data[0].period.start
          ? new Date(invoice.lines.data[0].period.start * 1000)
          : null;
        currentPeriodEnd = invoice.lines.data[0].period.end
          ? new Date(invoice.lines.data[0].period.end * 1000)
          : null;
      }

      // If not found in the invoice, use the existing billing record
      if (!currentPeriodStart && team.billing?.current_period_start) {
        currentPeriodStart = team.billing.current_period_start;
      }

      if (!currentPeriodEnd && team.billing?.current_period_end) {
        currentPeriodEnd = team.billing.current_period_end;
      }

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
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        requires_action_at_period_end:
          billingReason === "subscription_update" ||
          billingReason === "subscription_cycle",
        failed_at: new Date(),
        updatedBy: "system-stripe-webhook",

        // payment providers
        paymentProviders: this.createOrUpdatePaymentProvider(
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

      // For mid-cycle upgrade failures, we need to ensure we have a way to track when to take action
      if (billingReason === "subscription_update" && currentPeriodEnd) {
      }

      // Check if this is a first payment (subscription creation) failure
      const isFirstPayment = billingReason === "subscription_create";

      // Check if this is a payment failure during a plan upgrade
      const isUpgradeFailure = billingReason === "subscription_update";

      // Check if this is a renewal payment failure
      const isRenewalFailure = billingReason === "subscription_cycle";

      // For renewal failures, we only mark the billing status as failed but keep the current plan
      // until either payment succeeds or Stripe cancels the subscription after all retry attempts
      if (isRenewalFailure || isUpgradeFailure) {
        // Update only the billing status, but keep the current plan
        await this.updateTeamPlanWithBilling(
          metadata.hubId,
          team.plan,
          billingDetails,
        );
      } else if (isFirstPayment) {
        // For first payment failures (subscription creation), downgrade to Community plan
        const communityPlan = await this.stripeSubscriptionRepo.findPlanByName(
          PlanName.COMMUNITY,
        );
        if (!communityPlan) {
          return;
        }

        communityPlan.id = communityPlan._id;
        delete communityPlan._id;

        await this.updateTeamPlanWithBilling(
          metadata.hubId,
          communityPlan,
          billingDetails,
        );
      } else {
        // For other types of payment failures, just update the billing status
        await this.updateTeamPlanWithBilling(
          metadata.hubId,
          team.plan,
          billingDetails,
        );
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle invoice paid event (replacing invoice.payment_succeeded)
   * @param invoice The paid invoice object from Stripe
   */
  async handleInvoicePaid(invoice: any): Promise<void> {
    try {
      // Extract subscription ID and metadata
      const { subscriptionId, metadata } = this.extractInvoiceData(invoice);

      if (!subscriptionId) {
        console.warn("No subscription found in paid invoice");
        return;
      }

      // Validate metadata
      if (!metadata.planName || !metadata.hubId) {
        console.warn(
          "Required metadata (planName or hubId) not found in invoice",
        );
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

      // Check if team exists
      const team = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );
      if (!team) {
        console.error(`Team not found with ID: ${metadata.hubId}`);
        return;
      }
      // trial date
      const trialEndDateStr = metadata?.trial_end_date;
      let validLineItem = null;
      // Check if the trial is ongoing
      const isTrialOngoing =
        trialEndDateStr && new Date(trialEndDateStr).getTime() > Date.now();

      if (!isTrialOngoing) {
        validLineItem = invoice.lines?.data?.find(
          (item: any) => item.amount > 0,
        );
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

      // Create billing details object with successful payment status
      const billingDetails = {
        current_period_start: period.start
          ? new Date(period.start * 1000)
          : new Date(),
        current_period_end: period.end ? new Date(period.end * 1000) : null,
        amount_billed: invoice.amount_paid ? invoice.amount_paid / 100 : 0, // Convert cents to dollars
        currency: invoice.currency,
        status: SubscriptionStatus.ACTIVE,
        collection_method: invoice.collection_method,
        latest_invoice: invoice.id,
        seats: metadata?.userCount || 1,
        invoice_url: invoice.hosted_invoice_url,
        paid_at: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(),
        billingType: this.determineBillingType(
          {
            status: SubscriptionStatus.ACTIVE,
            discount: null,
            metadata: metadata,
          },
          metadata,
        ),
        updatedBy: "system-stripe-webhook",
        in_trial: isTrialOngoing || false,

        //payment providers
        paymentProviders: this.createOrUpdatePaymentProvider(
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

      await this.updateTeamPlanWithBilling(
        metadata.hubId,
        plan,
        billingDetails,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle invoice voided event
   * @param invoice The voided invoice object from Stripe
   */
  async handleInvoiceVoided(invoice: any): Promise<void> {
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
          updatedBy: "system-stripe-webhook",
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
   */
  async handleSubscriptionDeleted(subscription: any): Promise<void> {
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
        updatedBy: "system-stripe-webhook",
      };

      // Update team to community plan with deleted billing status
      await this.updateTeamPlanWithBilling(
        metadata.hubId,
        communityPlan,
        billingDetails,
      );
    } catch (error) {
      throw error;
    }
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
    // Extract subscription ID from various possible locations
    const subscriptionId =
      invoice.subscription ||
      invoice.parent?.subscription_details?.subscription ||
      invoice.lines?.data?.[0]?.subscription ||
      invoice.lines?.data?.[0]?.parent?.subscription_item_details?.subscription;

    // Initialize metadata object
    let metadata: any = {};

    // Try to extract metadata from different possible locations, in order of preference
    const metadataSources = [
      // Direct subscription metadata
      invoice.subscription_details?.metadata,
      // Parent subscription metadata
      invoice.parent?.subscription_details?.metadata,
      // Line item metadata
      invoice.lines?.data?.[0]?.metadata,
      // Invoice metadata itself
      invoice.metadata,
    ];

    // Use the first source that has a hubId
    for (const source of metadataSources) {
      if (source && source.hubId) {
        metadata = source;
        break;
      }
    }

    return { subscriptionId, metadata };
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
    metadata = metadata || {};

    // Check if all required fields are present
    const missingFields = requiredFields.filter((field) => !metadata[field]);

    if (missingFields.length > 0) {
      return { isValid: false, metadata };
    }

    return { isValid: true, metadata };
  }

  /**
   * Update team plan with billing details
   * @param hubId The team/hub ID
   * @param plan The plan object with id and name
   * @param billingDetails The billing details to update
   */
  private async updateTeamPlanWithBilling(
    hubId: string,
    plan: TeamsPlan,
    billingDetails: any,
  ): Promise<void> {
    const updateResult = await this.stripeSubscriptionRepo.updateTeamPlan(
      hubId,
      plan,
      {
        billing: billingDetails,
      },
    );

    if (updateResult.matchedCount === 0) {
      throw new NotFoundException(`Team not found with ID: ${hubId}`);
    }
  }

  /**
   * Update team and its workspaces with a new plan
   * @param hubId The team/hub ID
   * @param planName The name of the plan to apply
   * @param subscription The Stripe subscription object for billing details
   */
  private async updateTeamAndWorkspacesWithPlan(
    hubId: string,
    planName: string,
    subscription: any,
  ): Promise<void> {
    // Find the plan by name
    const plan = await this.stripeSubscriptionRepo.findPlanByName(planName);
    if (!plan) {
      throw new NotFoundException(`Plan not found with name: ${planName}`);
    }

    // Ensure the plan has an ID for the update
    plan.id = plan._id;
    delete plan._id;

    // Create billing details object
    const billingDetails = this.extractBillingDetails(subscription);

    // Update the team with the new plan
    await this.updateTeamPlanWithBilling(hubId, plan, billingDetails);
  }

  /**
   * Extract billing details from a subscription object
   * @param subscription The Stripe subscription object
   * @returns Object containing relevant billing details
   */
  private extractBillingDetails(subscription: any): any {
    const items = subscription.items?.data?.[0] || {};
    const plan = items.plan || subscription.plan || {};
    const { metadata } = this.extractInvoiceData(subscription) || {};

    return {
      current_period_start:
        subscription.current_period_start || items.current_period_start
          ? new Date(
              (subscription.current_period_start ||
                items.current_period_start) * 1000,
            )
          : new Date(),
      current_period_end:
        subscription.current_period_end || items.current_period_end
          ? new Date(
              (subscription.current_period_end || items.current_period_end) *
                1000,
            )
          : null,
      amount_billed: plan.amount ? plan.amount / 100 : 0, // Convert cents to dollars
      currency: subscription.currency,
      interval: plan.interval,
      interval_count: plan.interval_count,
      status: subscription.status,
      seats: metadata?.userCount || 1,
      collection_method: subscription.collection_method,
      latest_invoice: subscription.latest_invoice,
      billingType: this.determineBillingType(subscription, metadata),
      updatedBy: "system-stripe-webhook",

      // payment providers
      paymentProviders: this.createOrUpdatePaymentProvider(
        [], // Empty array since this is for new billing details
        PaymentProvider.STRIPE,
        {
          subscriptionId: subscription?.id,
          payment_method: subscription?.payment_settings?.payment_method_types,
          customerId: subscription?.customer,
        },
        true,
      ),
    };
  }

  /**
   * Extract subscription ID from payment providers array
   * @param paymentProviders Array of payment providers
   * @returns The Stripe subscription ID or null if not found
   */
  private extractSubscriptionIdFromPaymentProviders(
    paymentProviders: any[],
  ): string | null {
    if (!paymentProviders || !Array.isArray(paymentProviders)) {
      return null;
    }

    // Find the Stripe payment provider
    const stripeProvider = paymentProviders.find(
      (provider) =>
        provider.provider === PaymentProvider.STRIPE &&
        provider.currentPaymentMethod,
    );

    return stripeProvider?.subscriptionId || null;
  }

  /**
   * Check for subscriptions that need action at the end of their billing cycles
   * This method should be called by a scheduled job/cron
   */
  async checkSubscriptionsRequiringEndOfCycleAction(): Promise<void> {
    try {
      const now = new Date();

      // Find all teams with failed payments that require action at the end of their billing cycle
      // and where the current_period_end date has passed
      const teamsToProcess =
        await this.stripeSubscriptionRepo.findTeamsWithExpiredFailedSubscriptions(
          now,
        );

      if (!teamsToProcess || teamsToProcess.length === 0) {
        return;
      }

      // Process each team that needs action
      for (const team of teamsToProcess) {
        try {
          // Extract subscription ID from the new payment providers structure
          const subscriptionId = this.extractSubscriptionIdFromPaymentProviders(
            team.billing?.paymentProviders,
          );

          if (!subscriptionId) {
            continue;
          }

          // Check if Stripe service is available before attempting to cancel
          if (!this.stripeService) {
            continue;
          }

          // Cancel the subscription immediately through Stripe
          await this.stripeService.cancelSubscription(
            subscriptionId,
            true, // cancelImmediately = true
          );
        } catch (error) {
          console.error(
            `Error cancelling subscription for team ${team._id}:`,
            error,
          );
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check for expired trials and revert them to community plan
   * This method should be called by a scheduled job/cron
   */
  async checkAndRevertExpiredTrials(): Promise<void> {
    try {
      const now = new Date();

      // Find all teams with expired trials
      const teamsWithExpiredTrials =
        await this.stripeSubscriptionRepo.findTeamsWithExpiredTrials(now);

      if (!teamsWithExpiredTrials || teamsWithExpiredTrials.length === 0) {
        return;
      }

      // Find the community plan for downgrade
      const communityPlan = await this.stripeSubscriptionRepo.findPlanByName(
        PlanName.COMMUNITY,
      );
      if (!communityPlan) {
        console.error("Community plan not found");
        return;
      }

      communityPlan.id = communityPlan._id;
      delete communityPlan._id;

      // Process each team with expired trial
      for (const team of teamsWithExpiredTrials) {
        try {
          // Create billing details for expired trial
          const expiredTrialBillingDetails = {
            ...team.billing,
            status: "expired",
            billingType: BillingType.PAID,
            trial_expired_at: now,
            in_trial: false,
            reverted_to_community_at: now,
            updatedBy: "system-trial-expiry",
          };

          // Update team to community plan
          await this.updateTeamPlanWithBilling(
            team._id.toString(),
            communityPlan,
            expiredTrialBillingDetails,
          );
        } catch (error) {
          console.error(
            `Failed to revert expired trial for team ${team._id}:`,
            error,
          );
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle subscription schedule updated event
   * @param subscriptionSchedule The updated Stripe subscription schedule object
   */
  async handleSubscriptionScheduleUpdated(
    subscriptionSchedule: any,
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
      await this.updateTeamPlanWithBilling(hubId, team.plan, updatedBilling);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Determine billing type based on subscription and metadata
   * @param subscription The Stripe subscription object
   * @param metadata The subscription metadata
   * @returns BillingType enum value
   */
  private determineBillingType(subscription: any, metadata: any): BillingType {
    // trial date
    const trialEndDateStr = metadata?.trial_end_date;
    const isTrialOngoing =
      trialEndDateStr && new Date(trialEndDateStr).getTime() > Date.now();
    // Check if it's a trial period
    if (subscription.status === SubscriptionStatus.TRIALING || isTrialOngoing) {
      return BillingType.TRIAL;
    }

    // Default to paid
    return BillingType.PAID;
  }

  /**
   * Create or update payment provider in the array format
   * @param existingProviders Array of existing payment providers
   * @param provider The provider type (e.g., 'stripe')
   * @param providerData The provider-specific data
   * @param setAsCurrent Whether to set this as the current payment method
   * @returns Updated payment providers array
   */
  private createOrUpdatePaymentProvider(
    existingProviders: any[] = [],
    provider: PaymentProvider,
    providerData: any,
    setAsCurrent: boolean = true,
  ): any[] {
    // Create a copy of existing providers
    const providers = [...existingProviders];

    // Find existing provider of the same type
    const existingIndex = providers.findIndex((p) => p.provider === provider);

    // If setting as current, mark all others as not current
    if (setAsCurrent) {
      providers.forEach((p) => (p.currentPaymentMethod = false));
    }

    // Create new provider entry
    const newProvider = {
      id: uuidv4(),
      provider,
      currentPaymentMethod: setAsCurrent,
      ...providerData,
      updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
      // Update existing provider
      providers[existingIndex] = newProvider;
    } else {
      // Add new provider
      providers.push(newProvider);
    }

    return providers;
  }
}
