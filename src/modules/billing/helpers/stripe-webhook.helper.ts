import { Injectable } from "@nestjs/common";
import { StripeSubscriptionService } from "../services/stripe-subscription.service";
import {
  StripeWebhookGateway,
  PaymentEventType,
} from "../gateways/stripe-webhook.gateway";
import { StripeSubscriptionRepository } from "../repositories/stripe-subscription.repository";
import { SubscriptionStatus } from "@src/modules/common/enum/billing.enum";

@Injectable()
export class StripeWebhookHelper {
  constructor(
    private readonly stripeSubscriptionService: StripeSubscriptionService,
    private readonly stripeWebhookGateway: StripeWebhookGateway,
    private readonly stripeSubscriptionRepo: StripeSubscriptionRepository,
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

      case "subscription_schedule.updated":
        await this.handleSubscriptionScheduleUpdated(event);
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
    // Only handle for specific status changes, like cancellation
    await this.stripeSubscriptionService.handleSubscriptionUpdated(
      event.data.object,
      event.id,
    );

    // Get the updated team data
    const teamUpdated = await this.stripeSubscriptionRepo.findTeamById(
      event.data.object.metadata?.hubId,
    );

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
    }
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
}
