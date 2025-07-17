import { Injectable, Inject, Optional } from "@nestjs/common";
import {
  PaymentEmailService,
  PaymentEmailType,
  PaymentEmailData,
} from "../services/payment-email.service";
import { StripeCustomerService } from "../services/stripe-customer.service";

// Dynamically import payment methods service
let PaymentMethodsService: any;
try {
  const stripeBilling = require("@sparrowapp-dev/stripe-billing");
  PaymentMethodsService = stripeBilling.PaymentMethodsService;
} catch (error) {
  console.warn("Payment methods service not available");
}

@Injectable()
export class PaymentEmailHelper {
  constructor(
    private readonly paymentEmailService: PaymentEmailService,
    private readonly stripeCustomerService: StripeCustomerService,
    @Optional()
    @Inject(PaymentMethodsService)
    private readonly paymentMethodsService?: any,
  ) {}

  /**
   * Send payment success email using customer's default payment method email
   */
  async sendPaymentSuccessEmail(
    invoice: any,
    team: any,
    metadata: any,
  ): Promise<void> {
    try {
      const emailData = await this.buildEmailData(invoice, team, metadata);
      if (!emailData) return;

      await this.paymentEmailService.sendPaymentEmail(
        PaymentEmailType.PAYMENT_SUCCESS,
        emailData,
      );
    } catch (error) {
      console.error("Error sending payment success email:", error);
    }
  }

  /**
   * Send payment failed email using customer's default payment method email
   */
  async sendPaymentFailedEmail(
    invoice: any,
    team: any,
    metadata: any,
  ): Promise<void> {
    try {
      const emailData = await this.buildEmailData(invoice, team, metadata);
      if (!emailData) return;

      // Add failure-specific data
      const failedEmailData: PaymentEmailData = {
        ...emailData,
        amount: invoice.amount_due || 0,
        paymentDate: new Date(),
        failureReason: this.getPaymentFailureReason(invoice),
        receiptUrl: invoice.hosted_invoice_url,
      };

      await this.paymentEmailService.sendPaymentEmail(
        PaymentEmailType.PAYMENT_FAILED,
        failedEmailData,
      );
    } catch (error) {
      console.error("Error sending payment failed email:", error);
    }
  }

  /**
   * Send subscription canceled email
   */
  async sendSubscriptionCanceledEmail(
    subscription: any,
    team: any,
    metadata: any,
  ): Promise<void> {
    try {
      // For canceled subscriptions, we build email data differently
      const emailData = await this.buildCancelationEmailData(
        subscription,
        team,
        metadata,
      );
      if (!emailData) return;

      await this.paymentEmailService.sendPaymentEmail(
        PaymentEmailType.SUBSCRIPTION_CANCELED,
        emailData,
      );
    } catch (error) {
      console.error("Error sending subscription canceled email:", error);
    }
  }

  /**
   * Send subscription resubscribed email
   */
  async sendSubscriptionResubscribedEmail(
    subscription: any,
    team: any,
    metadata: any,
  ): Promise<void> {
    try {
      // For resubscribed subscriptions, we build email data similar to renewal
      const emailData = await this.buildResubscriptionEmailData(
        subscription,
        team,
        metadata,
      );
      if (!emailData) return;

      await this.paymentEmailService.sendPaymentEmail(
        PaymentEmailType.SUBSCRIPTION_RESUBSCRIBED,
        emailData,
      );
    } catch (error) {
      console.error("Error sending subscription resubscribed email:", error);
    }
  }

  /**
   * Send plan upgraded email using customer's default payment method email
   */
  async sendPlanUpgradedEmail(
    invoice: any,
    team: any,
    metadata: any,
    previousPlan: string,
    newPlan: string,
    interval?: string,
  ): Promise<void> {
    try {
      const emailData = await this.buildPlanUpgradeEmailData(
        invoice,
        team,
        metadata,
        previousPlan,
        newPlan,
        interval,
      );
      if (!emailData) return;

      await this.paymentEmailService.sendPaymentEmail(
        PaymentEmailType.PLAN_UPGRADED,
        emailData,
      );
    } catch (error) {
      console.error("Error sending plan upgraded email:", error);
    }
  }

  /**
   * Send plan downgraded email using customer's default payment method email
   */
  async sendPlanDowngradedEmail(
    team: any,
    startDate: Date,
    previousPlan: string,
    newPlan: string,
  ): Promise<void> {
    try {
      const emailData = await this.buildPlanDowngradeEmailData(
        team,
        startDate,
        previousPlan,
        newPlan,
      );
      if (!emailData) return;

      await this.paymentEmailService.sendPaymentEmail(
        PaymentEmailType.PLAN_DOWNGRADED,
        emailData,
      );
    } catch (error) {
      console.error("Error sending plan downgraded email:", error);
    }
  }

  /**
   * Send upcoming payment email using customer's default payment method email
   */
  async sendUpcomingPaymentEmail(
    invoice: any,
    team: any,
    metadata: any,
  ): Promise<void> {
    try {
      const emailData = await this.buildUpcomingPaymentEmailData(
        invoice,
        team,
        metadata,
      );
      if (!emailData) return;

      await this.paymentEmailService.sendPaymentEmail(
        PaymentEmailType.UPCOMING_PAYMENT,
        emailData,
      );
    } catch (error) {
      console.error("Error sending upcoming payment email:", error);
    }
  }

  /**
   * Send payment info updated email using customer's default payment method email
   */
  async sendPaymentInfoUpdatedEmail(
    paymentMethod: any,
    hubId: string,
    hubName?: string,
  ): Promise<void> {
    try {
      const emailData = await this.buildPaymentInfoUpdatedEmailData(
        paymentMethod,
        hubId,
        hubName,
      );
      if (!emailData) return;

      await this.paymentEmailService.sendPaymentEmail(
        PaymentEmailType.PAYMENT_INFO_UPDATED,
        emailData,
      );
    } catch (error) {
      console.error("Error sending payment info updated email:", error);
    }
  }

  /**
   * Build email data from invoice and team information
   */
  private async buildEmailData(
    invoice: any,
    team: any,
    metadata: any,
  ): Promise<PaymentEmailData | null> {
    if (!team?.name || !metadata?.hubId) {
      console.warn("Missing required team data for email");
      return null;
    }

    // Get customer email from default payment method
    const customerEmail = await this.getCustomerEmailFromPaymentMethod(
      metadata.hubId,
    );

    if (!customerEmail) {
      console.warn(
        "Could not retrieve customer email for payment notification",
      );
      return null;
    }

    const billingPeriod = this.extractBillingPeriod(invoice);

    return {
      hubId: metadata.hubId,
      hubName: team.name,
      ownerEmail: customerEmail.email,
      ownerName: customerEmail.name || "User",
      planName: metadata.planName || team.plan?.name || "Unknown Plan",
      amount: invoice.amount_paid || 0,
      currency: invoice.currency || "usd",
      paymentDate: new Date(
        invoice.status_transitions?.paid_at * 1000 || Date.now(),
      ),
      billingPeriodStart: billingPeriod.start,
      billingPeriodEnd: billingPeriod.end,
      receiptUrl: invoice.hosted_invoice_url,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
    };
  }

  /**
   * Build email data for subscription cancelation
   */
  private async buildCancelationEmailData(
    subscription: any,
    team: any,
    metadata: any,
  ): Promise<PaymentEmailData | null> {
    if (!team?.name || !metadata?.hubId) {
      console.warn("Missing required team data for cancelation email");
      return null;
    }

    // Get customer email from default payment method
    const customerEmail = await this.getCustomerEmailFromPaymentMethod(
      metadata.hubId,
    );

    if (!customerEmail) {
      console.warn(
        "Could not retrieve customer email for cancelation notification",
      );
      return null;
    }

    return {
      hubId: metadata.hubId,
      hubName: team.name,
      ownerEmail: customerEmail.email,
      ownerName: customerEmail.name || "User",
      planName: metadata.planName || team.plan?.name || "Unknown Plan",
      amount: 0, // No amount for cancelation
      currency: "usd",
      cancelAt: subscription.cancel_at,
      paymentDate: new Date(subscription.canceled_at * 1000 || Date.now()),
      billingPeriodStart: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000)
        : null,
      billingPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
      subscriptionId: subscription.id,
    };
  }

  /**
   * Build email data for subscription resubscription
   */
  private async buildResubscriptionEmailData(
    subscription: any,
    team: any,
    metadata: any,
  ): Promise<PaymentEmailData | null> {
    if (!team?.name || !metadata?.hubId) {
      console.warn("Missing required team data for resubscription email");
      return null;
    }

    // Get customer email from default payment method
    const customerEmail = await this.getCustomerEmailFromPaymentMethod(
      metadata.hubId,
    );

    if (!customerEmail) {
      console.warn(
        "Could not retrieve customer email for resubscription notification",
      );
      return null;
    }

    // Extract billing period and pricing from subscription items
    const subscriptionItem = subscription.items?.data?.[0];
    if (!subscriptionItem) {
      console.warn("No subscription items found for resubscription email");
      return null;
    }

    // Get billing period from subscription item
    const billingPeriodStart = subscriptionItem.current_period_start
      ? new Date(subscriptionItem.current_period_start * 1000)
      : null;

    const billingPeriodEnd = subscriptionItem.current_period_end
      ? new Date(subscriptionItem.current_period_end * 1000)
      : null;

    // Get pricing details from price or plan
    const price = subscriptionItem.price || subscriptionItem.plan;
    const amount = price?.unit_amount || 0;
    const currency = price?.currency || subscription.currency || "usd";
    const interval = price?.recurring?.interval || price?.interval || "month";

    return {
      hubId: metadata.hubId,
      hubName: team.name,
      ownerEmail: customerEmail.email,
      ownerName: customerEmail.name || "User",
      planName: metadata.planName || team.plan?.name || "Unknown Plan",
      amount: amount,
      currency: currency,
      paymentDate: new Date(),
      billingPeriodStart: billingPeriodStart,
      billingPeriodEnd: billingPeriodEnd,
      nextPaymentDate: billingPeriodEnd,
      subscriptionId: subscription.id,
      interval: interval,
    };
  }

  /**
   * Build email data for plan upgrade
   */
  private async buildPlanUpgradeEmailData(
    invoice: any,
    team: any,
    metadata: any,
    previousPlan: string,
    newPlan: string,
    interval?: string,
  ): Promise<PaymentEmailData | null> {
    if (!team?.name || !metadata?.hubId) {
      console.warn("Missing required team data for plan upgrade email");
      return null;
    }

    // Get customer email from default payment method
    const customerEmail = await this.getCustomerEmailFromPaymentMethod(
      metadata.hubId,
    );

    if (!customerEmail) {
      console.warn(
        "Could not retrieve customer email for plan upgrade notification",
      );
      return null;
    }

    const billingPeriod = this.extractBillingPeriod(invoice);

    return {
      hubId: metadata.hubId,
      hubName: team.name,
      ownerEmail: customerEmail.email,
      ownerName: customerEmail.name || "User",
      planName: newPlan || team.plan?.name || "Unknown Plan",
      previousPlanName: previousPlan || "Unknown Plan",
      amount: invoice.amount_paid || 0,
      currency: invoice.currency || "usd",
      paymentDate: new Date(
        invoice.status_transitions?.paid_at * 1000 || Date.now(),
      ),
      billingPeriodStart: billingPeriod.start,
      billingPeriodEnd: billingPeriod.end,
      receiptUrl: invoice.hosted_invoice_url,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      interval: interval,
    };
  }

  /**
   * Build email data for plan downgrade
   */
  private async buildPlanDowngradeEmailData(
    team: any,
    startDate: Date,
    previousPlan: string,
    newPlan: string,
  ): Promise<PaymentEmailData | null> {
    if (!team?.name) {
      console.warn("Missing required team data for plan downgrade email");
      return null;
    }

    // Get customer email from default payment method
    const customerEmail = await this.getCustomerEmailFromPaymentMethod(
      team._id.toString(),
    );

    if (!customerEmail) {
      console.warn(
        "Could not retrieve customer email for plan downgrade notification",
      );
      return null;
    }

    return {
      hubName: team.name,
      ownerEmail: customerEmail.email,
      ownerName: customerEmail.name || "User",
      planName: newPlan || "Unknown Plan",
      previousPlanName: previousPlan || "Unknown Plan",
      billingPeriodStart: startDate,
      hubId: team._id.toString(),
    };
  }

  /**
   * Build email data for upcoming payment
   */
  private async buildUpcomingPaymentEmailData(
    invoice: any,
    team: any,
    metadata: any,
  ): Promise<PaymentEmailData | null> {
    if (!team?.name || !metadata?.hubId) {
      console.warn("Missing required team data for upcoming payment email");
      return null;
    }

    // Get customer email from default payment method
    const customerEmail = await this.getCustomerEmailFromPaymentMethod(
      metadata.hubId,
    );

    if (!customerEmail) {
      console.warn(
        "Could not retrieve customer email for upcoming payment notification",
      );
      return null;
    }

    // Extract next payment date from invoice
    const nextPaymentDate = invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000)
      : invoice.due_date
        ? new Date(invoice.due_date * 1000)
        : null;

    // Get payment method details for card info
    let cardLast4 = "****";
    try {
      if (this.paymentMethodsService && invoice.customer) {
        const paymentMethods =
          await this.paymentMethodsService.getPaymentMethods(invoice.customer);
        const customer = await this.paymentMethodsService.getCustomer(
          invoice.customer,
        );

        // Handle the default payment method with enhanced logic (same as controller)
        let defaultPaymentMethodId: string | null = null;

        // First, check customer's invoice settings for default payment method
        if (customer?.invoice_settings?.default_payment_method) {
          defaultPaymentMethodId =
            typeof customer.invoice_settings.default_payment_method === "string"
              ? customer.invoice_settings.default_payment_method
              : customer.invoice_settings.default_payment_method.id;
        }

        // Find the default payment method and get card details
        const defaultPaymentMethod = paymentMethods?.find(
          (pm: any) => pm.id === defaultPaymentMethodId,
        );

        if (defaultPaymentMethod?.card?.last4) {
          cardLast4 = defaultPaymentMethod.card.last4;
        }
      }
    } catch (error) {
      console.warn("Could not retrieve card details:", error);
    }

    return {
      hubId: metadata.hubId,
      hubName: team.name,
      ownerEmail: customerEmail.email,
      ownerName: customerEmail.name || "User",
      planName: metadata.planName || team.plan?.name || "Unknown Plan",
      amount: invoice.amount_due || 0,
      currency: invoice.currency || "usd",
      nextPaymentDate: nextPaymentDate,
      cardLast4: cardLast4,
      updatePaymentUrl: `${process.env.FRONTEND_URL || "https://app.sparrowapp.dev"}/billing/${metadata.hubId}`,
    };
  }

  /**
   * Build email data for payment info updated
   */
  private async buildPaymentInfoUpdatedEmailData(
    paymentMethod: any,
    hubId: string,
    hubName?: string,
  ): Promise<PaymentEmailData | null> {
    if (!hubId) {
      console.warn("Missing required data for payment info updated email");
      return null;
    }

    // Get customer email from default payment method
    const customerEmail = await this.getCustomerEmailFromPaymentMethod(hubId);

    if (!customerEmail) {
      console.warn(
        "Could not retrieve customer email for payment info updated notification",
      );
      return null;
    }

    // Format the updated date
    const updatedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      hubId: hubId,
      hubName: hubName,
      ownerEmail: customerEmail.email,
      ownerName: customerEmail.name || "User",
      cardLast4: paymentMethod?.card?.last4 || "****",
      nameOnCard: paymentMethod?.billing_details?.name || "N/A",
      updatedDate: updatedDate,
    };
  }

  /**
   * Get customer email from their default payment method using the payment methods service
   */
  private async getCustomerEmailFromPaymentMethod(
    hubId: string,
  ): Promise<{ email: string; name: string } | null> {
    try {
      // Get Stripe customer ID using the lightweight service
      const customerId =
        await this.stripeCustomerService.getStripeCustomerId(hubId);

      if (!customerId) {
        console.warn(`No Stripe customer ID found for hub: ${hubId}`);
        return null;
      }

      if (!this.paymentMethodsService) {
        console.warn("Payment methods service not available");
        return null;
      }

      // Get customer's payment methods
      const paymentMethods =
        await this.paymentMethodsService.getPaymentMethods(customerId);

      if (!paymentMethods || paymentMethods.length === 0) {
        console.warn(`No payment methods found for customer: ${customerId}`);
        return null;
      }

      // Find the default payment method (isDefault: true)
      const defaultPaymentMethod = paymentMethods.find(
        (pm: any) => pm.isDefault === true,
      );

      if (!defaultPaymentMethod) {
        // If no default found, use the first payment method
        const firstPaymentMethod = paymentMethods[0];
        console.warn(
          `No default payment method found for customer: ${customerId}, using first available`,
        );

        return {
          email: firstPaymentMethod.billing_details?.email || "",
          name: firstPaymentMethod.billing_details?.name || "User",
        };
      }

      // Extract email and name from billing details
      const email = defaultPaymentMethod.billing_details?.email;
      const name = defaultPaymentMethod.billing_details?.name;

      if (!email) {
        console.warn(
          `No email found in payment method billing details for customer: ${customerId}`,
        );
        return null;
      }

      return { email, name: name || "User" };
    } catch (error) {
      console.error("Error getting customer email from payment method:", error);
      return null;
    }
  }

  /**
   * Extract billing period from invoice
   */
  private extractBillingPeriod(invoice: any): {
    start: Date | null;
    end: Date | null;
  } {
    // Filter out credit/discount line items and find the actual subscription line item
    const lineItems = invoice.lines?.data || [];
    const subscriptionLineItem = lineItems.find((item: any) => {
      // Look for positive amounts (not credits/discounts) and subscription items
      return item.amount > 0;
    });

    if (subscriptionLineItem?.period) {
      return {
        start: new Date(subscriptionLineItem.period.start * 1000),
        end: new Date(subscriptionLineItem.period.end * 1000),
      };
    }
    return { start: null, end: null };
  }

  /**
   * Get human-readable payment failure reason
   */
  private getPaymentFailureReason(invoice: any): string {
    // For failed invoices, we'll provide a generic but helpful message
    // since the specific failure details are in the payment intent/charge objects
    // which we don't have direct access to in the invoice webhook

    const billingReason = invoice.billing_reason;
    const attemptCount = invoice.attempt_count || 0;

    // Provide contextual failure messages based on invoice data
    if (attemptCount > 1) {
      return "Payment could not be processed after multiple attempts. Please check your payment method and try again.";
    }

    if (billingReason === "subscription_create") {
      return "Initial payment setup failed. Please verify your payment method details.";
    }

    if (billingReason === "subscription_cycle") {
      return "Recurring payment failed. Please check your card details or update your payment method.";
    }

    if (billingReason === "subscription_update") {
      return "Payment for plan upgrade failed. Please verify your payment method.";
    }

    // Default fallback message
    return "Payment could not be processed. Please check your payment method or contact your bank.";
  }
}
