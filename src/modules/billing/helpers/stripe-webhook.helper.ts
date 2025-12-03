import { Injectable } from "@nestjs/common";
import { StripeSubscriptionService } from "../services/stripe-subscription.service";
import {
  StripeWebhookGateway,
  PaymentEventType,
} from "../gateways/stripe-webhook.gateway";
import { StripeSubscriptionRepository } from "../repositories/stripe-subscription.repository";
import {
  SubscriptionStatus,
  BillingActorType,
  BillingSource,
} from "@src/modules/common/enum/billing.enum";
import { PaymentEmailHelper } from "../helpers/payment-email.helper";

@Injectable()
export class StripeWebhookHelper {
  constructor(
    private readonly stripeSubscriptionService: StripeSubscriptionService,
    private readonly stripeWebhookGateway: StripeWebhookGateway,
    private readonly stripeSubscriptionRepo: StripeSubscriptionRepository,
    private readonly paymentEmailHelper: PaymentEmailHelper,
  ) {}

  /**
   * Process webhook events based on their type
   * @param event The Stripe webhook event
   */
  async processWebhookEvent(event: any): Promise<void> {
    switch (event.type) {
      case "customer.subscription.created":
        await this.handleSubscriptionCreated(event);
        break;

      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event);
        break;

      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event);
        break;

      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(event);
        break;

      case "invoice.paid":
        await this.handleInvoicePaid(event);
        break;

      case "invoice.voided":
        await this.handleInvoiceVoided(event);
        break;

      case "invoice.upcoming":
        await this.handleInvoiceUpcoming(event);
        break;

      case "subscription_schedule.updated":
        await this.handleSubscriptionScheduleUpdated(event);
        break;

      case "payment_method.attached":
        await this.handlePaymentMethodAttached(event);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * Handle subscription created webhook event
   */
  private async handleSubscriptionCreated(event: any): Promise<void> {
    await this.stripeSubscriptionService.handleSubscriptionCreated(
      event.data.object,
      event.id,
    );

    // Get the updated team data to send to client
    const teamCreated = await this.stripeSubscriptionRepo.findTeamById(
      event.data.object.metadata?.hubId,
    );

    this.stripeWebhookGateway.emitPaymentEvent(
      PaymentEventType.SUBSCRIPTION_CREATED,
      {
        subscription: event.data.object,
        team: teamCreated,
      },
    );
  }

  /**
   * Handle subscription updated webhook event
   */
  private async handleSubscriptionUpdated(event: any): Promise<void> {
    // Check for resubscription (subscription reactivated)
    const isResubscribed = this.detectResubscription(event);
    // Only handle for specific status changes, like cancellation
    await this.stripeSubscriptionService.handleSubscriptionUpdated(
      event.data.object,
      event.id,
      isResubscribed
    );

    // Get the updated team data
    const teamUpdated = await this.stripeSubscriptionRepo.findTeamById(
      event.data.object.metadata?.hubId,
    );

    if (isResubscribed && teamUpdated) {
      // Send resubscription email
      await this.paymentEmailHelper.sendSubscriptionResubscribedEmail(
        event.data.object,
        teamUpdated,
        event.data.object.metadata,
      );
    }

    // Only emit event if there's a status change that matters
    if (event.data.object.status === SubscriptionStatus.CANCELED) {
      // Determine the event type based on cancellation reason
      let eventType = PaymentEventType.SUBSCRIPTION_CANCELED;

      // If cancellation was due to payment failure, use a specific event type
      if (
        event.data.object.cancellation_details?.reason ===
        PaymentEventType.PAYMENT_FAILED
      ) {
        eventType = PaymentEventType.SUBSCRIPTION_CANCELED_PAYMENT_FAILED;
      }

      this.stripeWebhookGateway.emitPaymentEvent(eventType, {
        subscription: event.data.object,
        team: teamUpdated,
        cancellationReason:
          event.data.object.cancellation_details?.reason || "unknown",
      });
    }

    // Send subscription canceled email using the helper
    if (
      event.data.object.cancel_at_period_end === true &&
      event.data.previous_attributes?.cancel_at_period_end === false &&
      event.data.object.cancellation_details?.reason ===
        "cancellation_requested"
    ) {
      await this.paymentEmailHelper.sendSubscriptionCanceledEmail(
        event.data.object,
        teamUpdated,
        event.data.object.metadata,
      );
    }
  }

  /**
   * Detect if a subscription has been reactivated (resubscribed)
   * @param event The Stripe webhook event
   * @returns Boolean indicating if this is a resubscription
   */
  private detectResubscription(event: any): boolean {
    const previousAttributes = event.data.previous_attributes;
    const subscription = event.data.object;

    // Step 1: Existing logic — look for metadata change in previous attributes
    if (previousAttributes) {
      const hasReactivatedMetadata = previousAttributes.metadata?.reactivatedAt;
      if (hasReactivatedMetadata) return true;
    }

    // Step 2: Fallback — check current `reactivatedAt` timestamp and time window
    // this is done to ensure we catch initial reactivation which stripe webhook may not always send with previous attribute metadata
    const reactivatedAt = subscription?.metadata?.reactivatedAt;

    if (reactivatedAt) {
      const reactivatedTime = new Date(reactivatedAt).getTime();
      const now = Date.now();
      const fiveSecondsInMs = 5000;

      // Return true only if reactivatedAt is within the last 5 seconds
      if (now - reactivatedTime <= fiveSecondsInMs) {
        return true;
      }
    }

    return false;
  }

  /**
   * Handle subscription deleted webhook event
   */
  private async handleSubscriptionDeleted(event: any): Promise<void> {
    await this.stripeSubscriptionService.handleSubscriptionDeleted(
      event.data.object,
      event.id,
    );

    // Get the updated team data
    const teamDeleted = await this.stripeSubscriptionRepo.findTeamById(
      event.data.object.metadata?.hubId,
    );

    // Determine the event type based on cancellation reason
    let deletedEventType = PaymentEventType.SUBSCRIPTION_DELETED;

    // If deletion was due to payment failure, use a specific event type
    if (
      event.data.object.cancellation_details?.reason ===
      SubscriptionStatus.PAYMENT_FAILED
    ) {
      deletedEventType = PaymentEventType.SUBSCRIPTION_DELETED_PAYMENT_FAILED;
    }

    this.stripeWebhookGateway.emitPaymentEvent(deletedEventType, {
      subscription: event.data.object,
      team: teamDeleted,
      cancellationReason:
        event.data.object.cancellation_details?.reason || "unknown",
    });
  }

  /**
   * Handle invoice paid webhook event
   */
  private async handleInvoicePaid(event: any): Promise<void> {
    await this.stripeSubscriptionService.handleInvoicePaid(
      event.data.object,
      event.id,
    );

    // Extract metadata from the invoice to find the related team
    const { metadata: paidMetadata } = this.extractInvoiceMetadata(
      event.data.object,
    );

    if (paidMetadata?.hubId) {
      const teamWithSuccessfulPayment =
        await this.stripeSubscriptionRepo.findTeamById(paidMetadata.hubId);

      this.stripeWebhookGateway.emitPaymentEvent(
        PaymentEventType.PAYMENT_SUCCESS,
        {
          invoice: event.data.object,
          team: teamWithSuccessfulPayment,
        },
      );

      // Send payment success email using the helper
      await this.paymentEmailHelper.sendPaymentSuccessEmail(
        event.data.object,
        teamWithSuccessfulPayment,
        paidMetadata,
      );
    }
  }

  /**
   * Handle invoice payment failed webhook event
   */
  private async handleInvoicePaymentFailed(event: any): Promise<void> {
    // Skip processing if this is a 3DS authentication scenario
    // Invoice status "open" with attempt_count 0 means payment is waiting for 3DS authentication
    if (
      event.data.object.status === "open" &&
      event.data.object.attempt_count === 0
    ) {
      return;
    }

    await this.stripeSubscriptionService.handleInvoicePaymentFailed(
      event.data.object,
      event.id,
    );

    // Extract metadata from the invoice to find the related team
    const { metadata: failedMetadata } = this.extractInvoiceMetadata(
      event.data.object,
    );

    if (failedMetadata?.hubId) {
      const teamWithFailedPayment =
        await this.stripeSubscriptionRepo.findTeamById(failedMetadata.hubId);

      this.stripeWebhookGateway.emitPaymentEvent(
        PaymentEventType.PAYMENT_FAILED,
        {
          invoice: event.data.object,
          team: teamWithFailedPayment,
        },
      );

      // Send payment failed email using the helper
      await this.paymentEmailHelper.sendPaymentFailedEmail(
        event.data.object,
        teamWithFailedPayment,
        failedMetadata,
      );
    }
  }

  /**
   * Handle invoice voided webhook event
   */
  private async handleInvoiceVoided(event: any): Promise<void> {
    await this.stripeSubscriptionService.handleInvoiceVoided(
      event.data.object,
      event.id,
    );

    // Extract metadata from the invoice to find the related team
    const { metadata: voidedMetadata } = this.extractInvoiceMetadata(
      event.data.object,
    );

    if (voidedMetadata?.hubId) {
      const teamWithVoidedInvoice =
        await this.stripeSubscriptionRepo.findTeamById(voidedMetadata.hubId);

      // Create a custom event type for voided invoices
      this.stripeWebhookGateway.emitPaymentEvent(
        PaymentEventType.INVOICE_VOIDED,
        {
          invoice: event.data.object,
          team: teamWithVoidedInvoice,
        },
      );
    }
  }

  /**
   * Handle invoice upcoming webhook event
   */
  private async handleInvoiceUpcoming(event: any): Promise<void> {
    // Extract metadata from the invoice to find the related team
    const { metadata: upcomingMetadata } = this.extractInvoiceMetadata(
      event.data.object,
    );

    if (upcomingMetadata?.hubId) {
      const teamWithUpcomingInvoice =
        await this.stripeSubscriptionRepo.findTeamById(upcomingMetadata.hubId);

      if (teamWithUpcomingInvoice) {
        // Send upcoming payment email notification
        try {
          await this.paymentEmailHelper.sendUpcomingPaymentEmail(
            event.data.object,
            teamWithUpcomingInvoice,
            upcomingMetadata,
          );
        } catch (error) {
          console.error("Error sending upcoming payment email:", error);
        }
      }
    }
  }

  /**
   * Handle subscription schedule updated webhook event
   */
  private async handleSubscriptionScheduleUpdated(event: any): Promise<void> {
    await this.stripeSubscriptionService.handleSubscriptionScheduleUpdated(
      event.data.object,
      event.id,
    );

    // Extract hubId from the subscription schedule metadata
    const scheduleHubId = this.extractHubIdFromSchedule(event.data.object);

    if (scheduleHubId) {
      const teamWithScheduleUpdate =
        await this.stripeSubscriptionRepo.findTeamById(scheduleHubId);

      this.stripeWebhookGateway.emitPaymentEvent(
        PaymentEventType.SUBSCRIPTION_SCHEDULE_UPDATED,
        {
          subscriptionSchedule: event.data.object,
          team: teamWithScheduleUpdate,
        },
      );
    }
  }

  /**
   * Extract metadata from an invoice, checking multiple potential locations
   * @param invoice The invoice object from Stripe
   * @returns Object containing subscriptionId and metadata
   */
  extractInvoiceMetadata(invoice: any): {
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
   * Extract hubId from subscription schedule phases metadata
   * @param subscriptionSchedule The subscription schedule object from Stripe
   * @returns The hubId string or null if not found
   */
  extractHubIdFromSchedule(subscriptionSchedule: any): string | null {
    if (
      !subscriptionSchedule.phases ||
      subscriptionSchedule.phases.length === 0
    ) {
      return null;
    }

    for (const phase of subscriptionSchedule.phases) {
      if (phase.metadata && phase.metadata.hubId) {
        return phase.metadata.hubId;
      }
    }

    return null;
  }

  /**
   * Handle payment method attached webhook event
   */
  private async handlePaymentMethodAttached(event: any): Promise<void> {
    const paymentMethod = event.data.object;
    const customerId = paymentMethod.customer;

    // Find the team associated with this customer via billing.customerId
    const team = await this.findTeamByCustomerId(customerId);

    if (team) {
      // Get billing audit service from the subscription service
      const billingAuditService = (this.stripeSubscriptionService as any)
        .billingAuditService;

      if (billingAuditService) {
        await billingAuditService.recordPaymentMethodAdded(
          team._id.toString(),
          {
            paymentMethodId: paymentMethod.id,
            type: paymentMethod.type,
            brand: paymentMethod.card?.brand,
            last4: paymentMethod.card?.last4,
          },
          {
            actor: {
              type: BillingActorType.SYSTEM,
              name: BillingSource.STRIPE_WEBHOOK,
            },
            source: BillingSource.STRIPE_WEBHOOK,
            externalId: event.id,
            reason: "Payment method attached via Stripe webhook",
          },
          {
            customerId,
          },
        );
      }
    }
  }

  /**
   * Helper method to find team by Stripe customer ID
   */
  private async findTeamByCustomerId(customerId: string): Promise<any> {
    try {
      return await this.stripeSubscriptionRepo.findTeamByCustomerId(customerId);
    } catch (error) {
      console.error("Error finding team by customer ID:", error);
      return null;
    }
  }
}
