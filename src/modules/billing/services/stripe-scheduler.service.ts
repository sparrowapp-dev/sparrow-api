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
   * Runs daily to handle all billing-related maintenance tasks:
   * 1. Send subscription expired emails for newly expired subscriptions/trials
   * 2. Check for subscriptions that need action at the end of their billing cycle
   * 3. Revert expired trials to community plan (Stripe & manual)
   * 4. Optimize licenses for subscriptions ending in 3 days
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyBillingMaintenance() {
    try {
      await this.stripeSubscriptionService.sendSubscriptionExpiredEmails();
      await this.stripeSubscriptionService.checkSubscriptionsRequiringEndOfCycleAction();
      await this.stripeSubscriptionService.checkAndRevertExpiredTrials();
      await this.stripeSubscriptionService.optimizeLicensesForUpcomingRenewals();
    } catch (error) {
      console.error("Error during daily billing maintenance:", error);
      throw error;
    }
  }
}
