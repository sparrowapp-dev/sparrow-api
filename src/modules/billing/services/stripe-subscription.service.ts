import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  Optional,
} from "@nestjs/common";
import { StripeSubscriptionRepository } from "../repositories/stripe-subscription.repository";

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
  private readonly logger = new Logger(StripeSubscriptionService.name);

  constructor(
    private readonly stripeSubscriptionRepo: StripeSubscriptionRepository,
    @Optional() @Inject(StripeService) private readonly stripeService: any,
  ) {
    if (!this.stripeService) {
      this.logger.warn(
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
      if (subscription.status !== "active") {
        this.logger.warn(
          `Subscription ${subscription.id} has status ${subscription.status}. Skipping team plan update.`,
        );
        return;
      }

      await this.updateTeamAndWorkspacesWithPlan(
        metadata.hubId,
        metadata.planName,
        subscription,
      );
    } catch (error) {
      this.logger.error(
        `Error handling customer.subscription.created event: ${error.message}`,
        error.stack,
      );
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
      if (subscription.status === "canceled") {
        this.logger.log(
          `Subscription ${subscription.id} has been canceled. Updating team plan.`,
        );

        // Find the community plan for downgrade
        const communityPlan =
          await this.stripeSubscriptionRepo.findPlanByName("Community");
        if (!communityPlan) {
          this.logger.error("Community plan not found in database");
          return;
        }

        // Get cancellation reason if available
        const cancellationReason =
          subscription.cancellation_details?.reason || "unknown";
        this.logger.log(`Cancellation reason: ${cancellationReason}`);

        // Update billing details for canceled subscription
        const billingDetails = {
          ...this.extractBillingDetails(subscription),
          status: "canceled",
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : new Date(),
          cancellation_reason: cancellationReason,
          updatedBy: "system-stripe-webhook",
        };

        // Update team to community plan with canceled billing status
        await this.updateTeamPlanWithBilling(
          metadata.hubId,
          {
            id: communityPlan._id,
            name: communityPlan.name,
          },
          billingDetails,
        );

        // Update associated workspaces
        const workspaceUpdateResult =
          await this.stripeSubscriptionRepo.updateWorkspacePlans(
            metadata.hubId,
            {
              id: communityPlan._id,
              name: communityPlan.name,
            },
          );

        this.logger.log(
          `Downgraded team ${metadata.hubId} and ${workspaceUpdateResult.modifiedCount} workspaces to Community plan due to subscription cancellation (reason: ${cancellationReason})`,
        );
      } else {
        this.logger.log(
          `Ignoring subscription.updated event for subscription ${subscription.id} with status ${subscription.status}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling customer.subscription.updated event: ${error.message}`,
        error.stack,
      );
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
        this.logger.warn("No subscription found in failed invoice");
        return;
      }

      if (!metadata.hubId) {
        this.logger.warn("No hubId found in failed invoice metadata");
        return;
      }

      // Check if team exists and get current subscription status
      const team = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );

      if (!team) {
        this.logger.warn(`Team not found with ID: ${metadata.hubId}`);
        return;
      }

      // Check if subscription is already in a terminal state (cancelled or deleted)
      // This prevents race conditions with subscription.deleted events
      if (team.billing && team.billing.status) {
        if (["canceled", "deleted"].includes(team.billing.status)) {
          this.logger.log(
            `Ignoring invoice.payment_failed event for subscription ${subscriptionId} because it's already in terminal state: ${team.billing.status}`,
          );
          return;
        }
      }

      // Determine the billing reason to handle the case properly
      const billingReason = invoice.billing_reason || "unknown";
      this.logger.log(
        `Invoice payment failed with billing reason: ${billingReason}`,
      );

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
        subscriptionId: subscriptionId,
        stripeCustomerId: invoice.customer,
        status: "payment_failed",
        collection_method: invoice.collection_method,
        latest_invoice: invoice.id,
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
      };

      // For mid-cycle upgrade failures, we need to ensure we have a way to track when to take action
      if (billingReason === "subscription_update" && currentPeriodEnd) {
        this.logger.log(
          `Mid-cycle upgrade payment failed. Current billing cycle ends at: ${currentPeriodEnd.toISOString()}. Marking for review at cycle end.`,
        );
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
          {
            id: team.plan.id,
            name: team.plan.name,
          },
          billingDetails,
        );

        this.logger.log(
          `Updated billing status for team ${metadata.hubId} to payment_failed. Keeping current plan active until final payment resolution or billing cycle end (${currentPeriodEnd?.toISOString() || "unknown"}).`,
        );
      } else if (isFirstPayment) {
        // For first payment failures (subscription creation), downgrade to Community plan
        // because the customer has never had access to the paid plan
        const communityPlan =
          await this.stripeSubscriptionRepo.findPlanByName("Community");
        if (!communityPlan) {
          this.logger.error("Community plan not found in database");
          return;
        }

        await this.updateTeamPlanWithBilling(
          metadata.hubId,
          {
            id: communityPlan._id,
            name: communityPlan.name,
          },
          billingDetails,
        );

        // Also update all workspaces associated with this team to Community plan
        const workspaceUpdateResult =
          await this.stripeSubscriptionRepo.updateWorkspacePlans(
            metadata.hubId,
            {
              id: communityPlan._id,
              name: communityPlan.name,
            },
          );

        this.logger.log(
          `Downgraded team ${metadata.hubId} and ${workspaceUpdateResult.modifiedCount} workspaces to Community plan due to initial payment failure`,
        );
      } else {
        // For other types of payment failures, just update the billing status
        await this.updateTeamPlanWithBilling(
          metadata.hubId,
          {
            id: team.plan.id,
            name: team.plan.name,
          },
          billingDetails,
        );

        this.logger.log(
          `Updated billing status for team ${metadata.hubId} to payment_failed due to ${billingReason}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling invoice.payment_failed event: ${error.message}`,
        error.stack,
      );
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
        this.logger.warn("No subscription found in paid invoice");
        return;
      }

      // Validate metadata
      if (!metadata.planName || !metadata.hubId) {
        this.logger.warn(
          "Required metadata (planName or hubId) not found in invoice",
        );
        return;
      }

      // Find the plan by name
      const plan = await this.stripeSubscriptionRepo.findPlanByName(
        metadata.planName,
      );
      if (!plan) {
        this.logger.error(`Plan not found with name: ${metadata.planName}`);
        return;
      }

      // Check if team exists
      const team = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );
      if (!team) {
        this.logger.error(`Team not found with ID: ${metadata.hubId}`);
        return;
      }

      // Get period data from the line item
      const period = invoice.lines?.data?.[0]?.period || {};

      // Create billing details object with successful payment status
      const billingDetails = {
        subscriptionId: subscriptionId,
        stripeCustomerId: invoice.customer,
        current_period_start: period.start
          ? new Date(period.start * 1000)
          : new Date(),
        current_period_end: period.end ? new Date(period.end * 1000) : null,
        amount_billed: invoice.amount_paid ? invoice.amount_paid / 100 : 0, // Convert cents to dollars
        currency: invoice.currency,
        status: "active",
        collection_method: invoice.collection_method,
        latest_invoice: invoice.id,
        invoice_url: invoice.hosted_invoice_url,
        paid_at: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(),
        updatedBy: "system-stripe-webhook",
      };

      await this.updateTeamPlanWithBilling(
        metadata.hubId,
        {
          id: plan._id,
          name: plan.name,
        },
        billingDetails,
      );

      // Update all workspaces associated with this team
      const workspaceUpdateResult =
        await this.stripeSubscriptionRepo.updateWorkspacePlans(metadata.hubId, {
          id: plan._id,
          name: plan.name,
        });

      this.logger.log(
        `Successfully processed payment for team ${metadata.hubId} on plan ${metadata.planName} and updated ${workspaceUpdateResult.modifiedCount} workspaces`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling invoice.paid event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Handle invoice voided event
   * @param invoice The voided invoice object from Stripe
   */
  async handleInvoiceVoided(invoice: any): Promise<void> {
    try {
      // Extract subscription ID and metadata
      const { subscriptionId, metadata } = this.extractInvoiceData(invoice);

      if (!metadata.hubId) {
        this.logger.warn("No hubId found in voided invoice metadata");
        return;
      }

      // Update team billing status to reflect that the invoice is no longer pending
      const team = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );
      if (!team) {
        this.logger.error(`Team not found with ID: ${metadata.hubId}`);
        return;
      }

      // Only update if the team has a billing record and the voided invoice is the latest one
      if (team.billing && team.billing.latest_invoice === invoice.id) {
        const updatedBilling = {
          ...team.billing,
          status:
            team.billing.status === "payment_failed"
              ? "active"
              : team.billing.status,
          invoice_voided: true,
          voided_at: new Date(),
          updatedBy: "system-stripe-webhook",
        };

        await this.stripeSubscriptionRepo.updateTeamPlan(
          metadata.hubId,
          {
            id: team.plan.id,
            name: team.plan.name,
          },
          {
            billing: updatedBilling,
          },
        );

        this.logger.log(
          `Updated team ${metadata.hubId} billing status for voided invoice ${invoice.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling invoice.voided event: ${error.message}`,
        error.stack,
      );
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

      this.logger.log(
        `Subscription ${subscription.id} has been deleted. Downgrading team plan.`,
      );

      // Find the community plan for downgrade
      const communityPlan =
        await this.stripeSubscriptionRepo.findPlanByName("Community");
      if (!communityPlan) {
        this.logger.error("Community plan not found in database");
        return;
      }

      // Get cancellation reason if available
      const cancellationReason =
        subscription.cancellation_details?.reason || "unknown";
      this.logger.log(
        `Cancellation reason for deleted subscription: ${cancellationReason}`,
      );

      // Update billing details for deleted subscription
      const billingDetails = {
        ...this.extractBillingDetails(subscription),
        status: "deleted",
        deleted_at: new Date(),
        ended_at: subscription.ended_at
          ? new Date(subscription.ended_at * 1000)
          : new Date(),
        cancellation_reason: cancellationReason,
        updatedBy: "system-stripe-webhook",
      };

      // Update team to community plan with deleted billing status
      await this.updateTeamPlanWithBilling(
        metadata.hubId,
        {
          id: communityPlan._id,
          name: communityPlan.name,
        },
        billingDetails,
      );

      // Update associated workspaces
      const workspaceUpdateResult =
        await this.stripeSubscriptionRepo.updateWorkspacePlans(metadata.hubId, {
          id: communityPlan._id,
          name: communityPlan.name,
        });

      this.logger.log(
        `Downgraded team ${metadata.hubId} and ${workspaceUpdateResult.modifiedCount} workspaces to Community plan due to subscription deletion (reason: ${cancellationReason})`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling customer.subscription.deleted event: ${error.message}`,
        error.stack,
      );
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
      this.logger.warn(
        `Required metadata fields not found: ${missingFields.join(", ")}`,
      );
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
    plan: { id: any; name: string },
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

    // Create billing details object
    const billingDetails = this.extractBillingDetails(subscription);

    // Update the team with the new plan
    await this.updateTeamPlanWithBilling(
      hubId,
      {
        id: plan._id,
        name: plan.name,
      },
      billingDetails,
    );

    // Also update all workspaces associated with this team
    const workspaceUpdateResult =
      await this.stripeSubscriptionRepo.updateWorkspacePlans(hubId, {
        id: plan._id,
        name: plan.name,
      });

    this.logger.log(
      `Updated ${workspaceUpdateResult.modifiedCount} workspaces for team ${hubId} with plan ${plan.name}`,
    );
  }

  /**
   * Extract billing details from a subscription object
   * @param subscription The Stripe subscription object
   * @returns Object containing relevant billing details
   */
  private extractBillingDetails(subscription: any): any {
    const items = subscription.items?.data?.[0] || {};
    const plan = items.plan || subscription.plan || {};

    return {
      subscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
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
      collection_method: subscription.collection_method,
      latest_invoice: subscription.latest_invoice,
      updatedBy: "system-stripe-webhook",
    };
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
        this.logger.log("No subscriptions requiring end-of-cycle action found");
        return;
      }

      this.logger.log(
        `Found ${teamsToProcess.length} subscriptions requiring end-of-cycle action`,
      );

      // Process each team that needs action
      for (const team of teamsToProcess) {
        try {
          if (!team.billing?.subscriptionId) {
            this.logger.warn(
              `Team ${team._id} marked for end-of-cycle action but has no subscription ID`,
            );
            continue;
          }

          this.logger.log(
            `Processing end-of-cycle action for team ${team._id}, subscription ${team.billing.subscriptionId}. Billing cycle ended at ${team.billing.current_period_end.toISOString()}`,
          );

          // Check if Stripe service is available before attempting to cancel
          if (!this.stripeService) {
            this.logger.error(
              `Cannot cancel subscription ${team.billing.subscriptionId} for team ${team._id} - Stripe service is not available`,
            );
            continue;
          }

          // Cancel the subscription immediately through Stripe
          await this.stripeService.cancelSubscription(
            team.billing.subscriptionId,
            true, // cancelImmediately = true
          );

          this.logger.log(
            `Canceled subscription ${team.billing.subscriptionId} for team ${team._id} due to unresolved payment failure at billing cycle end`,
          );
        } catch (error) {
          this.logger.error(
            `Error processing end-of-cycle action for team ${team._id}: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error checking subscriptions requiring end-of-cycle action: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
