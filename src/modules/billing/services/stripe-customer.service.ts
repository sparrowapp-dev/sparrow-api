import { Injectable, NotFoundException } from "@nestjs/common";
import { AdminHubsRepository } from "@src/modules/user-admin/repositories/user-admin.hubs.repository";
import { PaymentProvider } from "@src/modules/common/enum/billing.enum";

@Injectable()
export class StripeCustomerService {
  constructor(private readonly adminHubsRepo: AdminHubsRepository) {}

  /**
   * Get Stripe customer ID for a hub
   * @param hubId The hub/team ID
   * @returns The Stripe customer ID or null if not found
   */
  async getStripeCustomerId(hubId: string): Promise<string | null> {
    try {
      const hub = await this.adminHubsRepo.findHubById(hubId);

      if (!hub) {
        throw new NotFoundException("Hub not found");
      }

      // Check new billing structure with array-based payment providers
      if (
        hub.billing?.paymentProviders &&
        Array.isArray(hub.billing.paymentProviders)
      ) {
        // Find the current Stripe payment provider
        const stripeProvider = hub.billing.paymentProviders.find(
          (provider: any) =>
            provider.provider === PaymentProvider.STRIPE &&
            provider.currentPaymentMethod === true,
        );

        if (stripeProvider?.customerId) {
          return stripeProvider.customerId;
        }

        // If no current provider found, try to find any Stripe provider
        const anyStripeProvider = hub.billing.paymentProviders.find(
          (provider: any) =>
            provider.provider === PaymentProvider.STRIPE && provider.customerId,
        );

        if (anyStripeProvider?.customerId) {
          return anyStripeProvider.customerId;
        }
      }

      // Fallback to legacy structure for backward compatibility
      return hub.stripeCustomerId || hub.billing?.stripeCustomerId || null;
    } catch (error) {
      console.error("Error fetching Stripe customer ID:", error);
      throw error;
    }
  }
}