import {
  PaymentProvider,
  BillingType,
  SubscriptionStatus,
  BillingSource,
} from "@src/modules/common/enum/billing.enum";
import { v4 as uuidv4 } from "uuid";

/**
 * Helper functions for Stripe subscription operations
 */
export class StripeSubscriptionHelpers {
  /**
   * Validate metadata to ensure required fields are present
   * @param metadata The metadata object to validate
   * @param requiredFields Array of required field names
   * @returns Object with isValid flag and the metadata
   */
  static validateMetadata(
    metadata: any,
    requiredFields: string[],
  ): { isValid: boolean; metadata: any } {
    metadata = metadata || {};

    // Check if all required fields are present
    const missingFields = requiredFields.filter((field) => !metadata[field]);

    if (missingFields.length > 0) {
      console.error(
        `Missing required metadata fields: ${missingFields.join(", ")}`,
      );
      return { isValid: false, metadata };
    }

    return { isValid: true, metadata };
  }

  /**
   * Extract metadata from an invoice, checking multiple potential locations
   * @param invoice The invoice object from Stripe
   * @returns Object containing subscriptionId and metadata
   */
  static extractInvoiceData(invoice: any): {
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
      invoice.subscription_details?.metadata,
      invoice.parent?.subscription_details?.metadata,
      invoice.lines?.data?.[0]?.metadata,
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
   * Extract billing details from a subscription object
   * @param subscription The Stripe subscription object
   * @param eventId Optional Stripe event ID for tracking
   * @returns Object containing relevant billing details
   */
  static extractBillingDetails(subscription: any, eventId?: string): any {
    const items = subscription.items?.data?.[0] || {};
    const plan = items.plan || subscription.plan || {};
    const { metadata } =
      StripeSubscriptionHelpers.extractInvoiceData(subscription) || {};

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
      amount_billed: plan.amount ? plan.amount / 100 : 0,
      currency: subscription.currency,
      interval: plan.interval,
      interval_count: plan.interval_count,
      status: subscription.status,
      seats: metadata?.userCount || 1,
      collection_method: subscription.collection_method,
      latest_invoice: subscription.latest_invoice,
      billingType: StripeSubscriptionHelpers.determineBillingType(
        subscription,
        metadata,
      ),
      updatedBy: BillingSource.STRIPE_WEBHOOK,
      event_id: eventId,
      paymentProviders: StripeSubscriptionHelpers.createOrUpdatePaymentProvider(
        [],
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
   * Determine billing type based on subscription and metadata
   * @param subscription The Stripe subscription object
   * @param metadata The subscription metadata
   * @returns BillingType enum value
   */
  static determineBillingType(subscription: any, metadata: any): BillingType {
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
  static createOrUpdatePaymentProvider(
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

  /**
   * Calculate billing cycle from period dates
   * @param periodStart Start date of the period
   * @param periodEnd End date of the period
   * @returns Object containing billing cycle information
   */
  static calculateBillingCycle(
    periodStart: Date,
    periodEnd: Date,
  ): {
    billingCycle: string;
    intervalCount: number;
    interval: string;
  } {
    const daysDifference = Math.round(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDifference >= 350 && daysDifference <= 380) {
      // Annual billing (accounting for leap years)
      return {
        billingCycle: "1 year",
        intervalCount: 1,
        interval: "year",
      };
    } else if (daysDifference >= 28 && daysDifference <= 31) {
      // Monthly billing
      return {
        billingCycle: "1 month",
        intervalCount: 1,
        interval: "month",
      };
    } else {
      // Default to monthly if we can't determine
      return {
        billingCycle: "1 month",
        intervalCount: 1,
        interval: "month",
      };
    }
  }

  /**
   * Check if a subscription status is terminal (cancelled or deleted)
   * @param status The subscription status
   * @returns Boolean indicating if the status is terminal
   */
  static isTerminalStatus(status: string): boolean {
    return [
      SubscriptionStatus.CANCELED,
      SubscriptionStatus.DELETED,
      SubscriptionStatus.INCOMPLETE_EXPIRED,
    ].includes(status as SubscriptionStatus);
  }

  /**
   * Determine payment failure type based on billing reason
   * @param billingReason The reason for the billing attempt
   * @returns Object with failure type information
   */
  static determinePaymentFailureType(billingReason: string): {
    isFirstPayment: boolean;
    isUpgradeFailure: boolean;
    isRenewalFailure: boolean;
  } {
    const isFirstPayment = billingReason === "subscription_create";
    const isUpgradeFailure = billingReason === "subscription_update";
    const isRenewalFailure = billingReason === "subscription_cycle";

    return {
      isFirstPayment,
      isUpgradeFailure,
      isRenewalFailure,
    };
  }
}
