import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { StripeSubscriptionService } from "./stripe-subscription.service";

/**
 * Service for scheduling stripe subscription-related tasks
 */
@Injectable()
export class StripeSchedulerService {
  private readonly logger = new Logger(StripeSchedulerService.name);

  constructor(
    private readonly stripeSubscriptionService: StripeSubscriptionService,
  ) {}

  /**
   * Runs daily to check for subscriptions that need action at the end of their billing cycle
   * This handles cases where payment failed mid-cycle (especially upgrades) and the cycle has ended
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleEndOfCycleFailedPayments() {
    this.logger.log(
      "Running scheduled job to check for subscriptions requiring end-of-cycle actions",
    );

    try {
      await this.stripeSubscriptionService.checkSubscriptionsRequiringEndOfCycleAction();
      this.logger.log(
        "Completed scheduled job for end-of-cycle payment failures",
      );
    } catch (error) {
      this.logger.error(
        `Error executing scheduled job for end-of-cycle payment failures: ${error.message}`,
        error.stack,
      );
    }
  }
}
