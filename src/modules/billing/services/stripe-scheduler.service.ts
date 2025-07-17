import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { StripeSubscriptionService } from "./stripe-subscription.service";

/**
 * Service for scheduling billing-related maintenance tasks
 */
@Injectable()
export class StripeSchedulerService {
  constructor(
    private readonly stripeSubscriptionService: StripeSubscriptionService,
  ) {}

  /**
   * Runs daily to perform billing maintenance tasks:
   * 1. Send subscription expired emails for newly expired subscriptions/trials
   * 2. Check for subscriptions that need action at the end of their billing cycle
   * 3. Check for expired trials (both Stripe and manual) and revert to community plan
   *
   * This consolidated job handles both Stripe-managed and manually-managed billing scenarios
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleBillingMaintenance() {
    try {
      // Send subscription expired emails for newly expired subscriptions/trials (immediate)
      await this.stripeSubscriptionService.sendSubscriptionExpiredEmails();

      // Handle failed payments that require action at period end (3 days after expiry)
      await this.stripeSubscriptionService.checkSubscriptionsRequiringEndOfCycleAction();

      // Handle expired trials (manual flows) (3 days after expiry)
      await this.stripeSubscriptionService.checkAndRevertExpiredTrials();
    } catch (error) {
      console.error("Error during billing maintenance:", error);
      throw error;
    }
  }
}
