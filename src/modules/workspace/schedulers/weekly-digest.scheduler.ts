import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WeeklyDigestService } from "../services/weekly-digest.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class WeeklyDigestScheduler {
  private readonly logger = new Logger(WeeklyDigestScheduler.name);

  constructor(
    private readonly weeklyDigestService: WeeklyDigestService,
    private readonly configService: ConfigService,
  ) {}

  // Runs every Monday at 8:00 AM
  @Cron("0 8 * * 1", {
    name: "weekly-digest",
    timeZone: "Asia/Kolkata",
    waitForCompletion: true,
  })
  async handleWeeklyDigest() {
    const env = this.configService.get<string>("APP_ENV")?.toUpperCase();

    if (env !== "PROD") {
      this.logger.log(`Skipping Weekly Digest Job in ${env} environment`);
      return;
    }

    this.logger.log("Starting Weekly Digest Job...");

    try {
      await this.weeklyDigestService.processWeeklyDigest();
    } catch (error) {
      this.logger.error("Weekly Digest job failed", error);
    }
  }
}
