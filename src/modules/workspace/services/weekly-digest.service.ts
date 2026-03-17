import { Injectable, Logger } from "@nestjs/common";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import { TestflowRepository } from "../repositories/testflow.repository";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import { CollectionRepository } from "../repositories/collection.repository";

@Injectable()
export class WeeklyDigestService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly testflowRepository: TestflowRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly collectionRepository: CollectionRepository,
  ) {}

  private readonly logger = new Logger(WeeklyDigestService.name);

  async processWeeklyDigest() {
    this.logger.log("Processing weekly digest emails...");

    const { start, end } = this.getLastWeekRange();
    const { start: prevStart, end: prevEnd } = this.getPreviousWeekRange();

    // Fetch users
    const users = await this.userRepository.getAllUsers();

    this.logger.log(`Total users found: ${users.length}`);

    let testflows: any[] = [];

    try {
      testflows = await this.testflowRepository.getAll();
    } catch {
      this.logger.warn("No testflows found in database.");
    }

    // Workspace metric
    const newWorkspaces = await this.workspaceRepository.getNewWorkspacesCount(
      start,
      end,
    );

    // Collection metrics
    const newCollections =
      await this.collectionRepository.getNewCollectionsCount(start, end);

    const apisCreated = await this.collectionRepository.getApisCreatedCount(
      start,
      end,
    );

    // Testflow executions
    const testflowExecutions =
      await this.testflowRepository.getTestflowsExecutionCount(start, end);

    // Active workspaces
    const activeWorkspaces =
      await this.workspaceRepository.getActiveWorkspacesCount(start, end);

    // Logs
    this.logger.log(`Testflows Executed: ${testflowExecutions}`);
    this.logger.log(`Active Workspaces: ${activeWorkspaces}`);
    this.logger.log(`New Workspaces: ${newWorkspaces}`);
    this.logger.log(`New Collections: ${newCollections}`);
    this.logger.log(`APIs Created: ${apisCreated}`);

    for (const user of users) {
      const trend = await this.getExecutionTrend(
        user._id.toString(),
        start,
        end,
        prevStart,
        prevEnd,
        testflows,
      );

      this.logger.log(
        `User: ${user.email} | Total: ${trend.totalExecutions} | Change: ${trend.percentChange}%`,
      );

      this.logger.log(`Daily: ${trend.dailyExecutions}`);
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

  private getPreviousWeekRange() {
    const now = new Date();

    const end = new Date(now);
    end.setDate(now.getDate() - now.getDay() - 7);
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }

  async getExecutionTrend(
    userId: string,
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
    testflows: any[],
  ) {
    let currentCount = 0;
    let previousCount = 0;

    const dailyExecutions = Array(7).fill(0); // Mon → Sun

    for (const testflow of testflows) {
      if (!testflow.schedules) continue;

      for (const schedule of testflow.schedules) {
        if (!schedule.schedularRunHistory) continue;

        for (const run of schedule.schedularRunHistory) {
          const runDate = new Date(run.createdAt);

          const count = (run.successRequests || 0) + (run.failedRequests || 0);

          // Current week
          if (runDate >= currentStart && runDate <= currentEnd) {
            currentCount += count;

            const dayIndex = (runDate.getDay() + 6) % 7; // convert Sun=0 → Mon=0
            dailyExecutions[dayIndex] += count;
          }

          // Previous week
          if (runDate >= previousStart && runDate <= previousEnd) {
            previousCount += count;
          }
        }
      }
    }

    const percentChange =
      previousCount === 0
        ? currentCount > 0
          ? 100
          : 0
        : Math.round(((currentCount - previousCount) / previousCount) * 100);

    return {
      totalExecutions: currentCount,
      percentChange,
      dailyExecutions,
    };
  }
}
