import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { WeeklyDigestService } from "../services/weekly-digest.service";

@Injectable()
export class WeeklyDigestScheduler {
  private readonly logger = new Logger(WeeklyDigestScheduler.name);

  constructor(private readonly weeklyDigestService: WeeklyDigestService) {}

  /**
   * Runs every Monday at 08:00 AM
   */
  @Cron("*/10 * * * * *")
  async handleWeeklyDigest() {
    this.logger.log("Starting Weekly Digest Job...");

    try {
      await this.weeklyDigestService.processWeeklyDigest();
    } catch (error) {
      this.logger.error("Weekly Digest job failed", error);
    }
  }
}
