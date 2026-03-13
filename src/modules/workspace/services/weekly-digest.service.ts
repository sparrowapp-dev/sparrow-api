import { Injectable, Logger } from "@nestjs/common";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import { TestflowRepository } from "../repositories/testflow.repository";

@Injectable()
export class WeeklyDigestService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly testflowRepository: TestflowRepository,
  ) {}

  private readonly logger = new Logger(WeeklyDigestService.name);

  async processWeeklyDigest() {
    this.logger.log("Processing weekly digest emails...");

    const { start, end } = this.getLastWeekRange();

    this.logger.log(
      `Weekly range: ${start.toISOString()} - ${end.toISOString()}`,
    );

    const users = await this.userRepository.getAllUsers();

    this.logger.log(`Total users found: ${users.length}`);

    for (const user of users) {
      this.logger.log(`Preparing digest for: ${user.email}`);
    }

    for (const user of users) {
      const executionCount = await this.getExecutionCountForUser(
        user._id.toString(),
        start,
        end,
      );

      this.logger.log(
        `User: ${user.email} | Weekly Executions: ${executionCount}`,
      );
    }
  }

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

  async getExecutionCountForUser(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    let testflows = [];

    try {
      testflows = await this.testflowRepository.getAll();
    } catch (error) {
      // If no testflows exist, simply return 0 executions
      this.logger.warn("No testflows found in database.");
      return 0;
    }

    let executionCount = 0;

    for (const testflow of testflows) {
      if (!testflow.schedules) continue;

      for (const schedule of testflow.schedules) {
        if (!schedule.schedularRunHistory) continue;

        for (const run of schedule.schedularRunHistory) {
          const runDate = new Date(run.createdAt);

          if (runDate >= start && runDate <= end) {
            executionCount +=
              (run.successRequests || 0) + (run.failedRequests || 0);
          }
        }
      }
    }

    return executionCount;
  }
}
