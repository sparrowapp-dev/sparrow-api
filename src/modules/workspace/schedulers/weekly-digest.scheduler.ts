import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WeeklyDigestService } from "../services/weekly-digest.service";

@Injectable()
export class WeeklyDigestScheduler {
  private readonly logger = new Logger(WeeklyDigestScheduler.name);

  constructor(private readonly weeklyDigestService: WeeklyDigestService) {}

  // Disabled until we are sure it works correctly and doesn't cause issues with the database load. We can enable it later once we have confidence in its stability.
  @Cron(CronExpression.EVERY_MINUTE, {
    name: "weekly-digest",
    waitForCompletion: true,
  })
  async handleWeeklyDigest() {
    this.logger.log("Starting Weekly Digest Job...");

    try {
      await this.weeklyDigestService.processWeeklyDigest();
    } catch (error) {
      this.logger.error("Weekly Digest job failed", error);
    }
  }
}
