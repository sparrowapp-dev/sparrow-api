import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class WeeklyDigestService {
  private readonly logger = new Logger(WeeklyDigestService.name);

  private getLastWeekRange() {
    const now = new Date();

    // Start = last Monday
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - 6);
    start.setHours(0, 0, 0, 0);

    // End = last Sunday
    const end = new Date(now);
    end.setDate(now.getDate() - now.getDay());
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  async processWeeklyDigest() {
    this.logger.log("Processing weekly digest emails...");

    const { start, end } = this.getLastWeekRange();

    this.logger.log(
      `Weekly range: ${start.toISOString()} - ${end.toISOString()}`,
    );

    // next steps will use this

    // Step 1: get all users
    // Step 2: fetch weekly metrics
    // Step 3: build email payload
    // Step 4: send email
  }
}
