import { Injectable, Logger } from "@nestjs/common";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
// testflow/workspace/collection repositories are not needed here; metrics come from UserMetricsRepository
import { EmailService } from "@src/modules/common/services/email.service";
import { ConfigService } from "@nestjs/config";
import { UpdatesRepository } from "../repositories/updates.repository";
import { UserInvitesRepository } from "@src/modules/identity/repositories/userInvites.repository";
import { UserMetricsRepository } from "../repositories/userMetrics.repository";
import { ObjectId, WithId } from "mongodb";
import { User } from "@src/modules/common/models/user.model";
import { UserMetricsData } from "@src/modules/common/models/user-metrics.model";

/** Configuration for batch processing and concurrency */
interface BatchConfig {
  userBatchSize: number;
  emailConcurrency: number;
}

/** Per-user metrics computed via batch aggregation */
interface UserMetrics {
  activeWorkspaces: number;
  collectionsCount: number;
  apisCount: number;
  testflowExecutions: number;
  newWorkspaces: number;
}

/** Activity graph data for the digest */
interface ActivityGraph {
  totalExecutions: number;
  percentChange: number;
  graph: Array<{ height: number; isMax: boolean }>;
}

/** Email data for a single user including their metrics */
interface UserEmailData {
  user: WithId<User>;
  metrics: UserMetrics;
  collaborationUpdates: string[];
  pendingActions: string[];
}

@Injectable()
export class WeeklyDigestService {
  private static readonly QA_DIGEST_EMAIL = "mayank9@yopmail.com";
  private static readonly DEFAULT_BATCH_SIZE = 100;
  private static readonly DEFAULT_EMAIL_CONCURRENCY = 5;

  private readonly logger = new Logger(WeeklyDigestService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly updatesRepository: UpdatesRepository,
    private readonly userMetricsRepository: UserMetricsRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly userInvitesRepository: UserInvitesRepository,
  ) {}

  /**
   * Main entry point for processing weekly digest emails.
   * Uses batching and cursor-based pagination to handle large user counts efficiently.
   * All metrics are computed per-batch using MongoDB aggregation pipelines.
   */
  async processWeeklyDigest(): Promise<void> {
    this.logger.log("Processing weekly digest emails...");

    const config: BatchConfig = {
      userBatchSize: WeeklyDigestService.DEFAULT_BATCH_SIZE,
      emailConcurrency: WeeklyDigestService.DEFAULT_EMAIL_CONCURRENCY,
    };

    const qaDigestEmail = WeeklyDigestService.QA_DIGEST_EMAIL;

    // Time range for the digest (last 1 min for testing, or use getLastWeekRange() for production)
    const end = new Date();
    const start = new Date(end.getTime() - 1 * 60 * 1000);
    const prevEnd = new Date(start);
    const prevStart = new Date(prevEnd.getTime() - 1 * 60 * 1000);

    // Fetch lightweight global activity graph (only updates collection, not heavy)
    const activityGraph = await this.fetchActivityGraph(
      start,
      end,
      prevStart,
      prevEnd,
    );

    // Process users in batches using cursor-based pagination
    let lastCursor: ObjectId | undefined;
    let totalUsersProcessed = 0;
    let batchNumber = 0;

    while (true) {
      batchNumber++;
      this.logger.log(`Starting batch ${batchNumber}...`);

      // Fetch the next batch of users
      const usersBatch = await this.getUsersBatch(
        config.userBatchSize,
        lastCursor,
        qaDigestEmail,
      );

      if (usersBatch.length === 0) {
        this.logger.log(`No more users to process. Ending batch processing.`);
        break;
      }

      this.logger.log(
        `Batch ${batchNumber}: Processing ${usersBatch.length} users...`,
      );

      // Extract user IDs and emails for batch queries
      const userIds = usersBatch.map((u) => u._id.toString());
      const emails = usersBatch.map((u) => u.email);

      // Fetch per-user data using precomputed user metrics (no aggregation)
      const userEmailDataMap = await this.getMetricsForUserBatch(
        start,
        end,
        userIds,
        emails,
        usersBatch,
      );

      // Send emails with controlled concurrency
      await this.sendEmailsBatch(
        userEmailDataMap,
        activityGraph,
        start,
        end,
        config.emailConcurrency,
      );

      totalUsersProcessed += usersBatch.length;
      this.logger.log(
        `Batch ${batchNumber} complete. Total users processed: ${totalUsersProcessed}`,
      );

      // Update cursor for next batch
      lastCursor = usersBatch[usersBatch.length - 1]._id;

      // If we got fewer users than the batch size, we've reached the end
      if (usersBatch.length < config.userBatchSize) {
        this.logger.log(`Reached end of users. Stopping batch processing.`);
        break;
      }
    }

    this.logger.log(
      `Weekly digest processing complete. Total users processed: ${totalUsersProcessed}`,
    );
  }

  /**
   * Fetch a batch of users using cursor-based pagination.
   */
  private async getUsersBatch(
    batchSize: number,
    lastCursor?: ObjectId,
    qaEmail?: string,
  ): Promise<WithId<User>[]> {
    return this.userRepository.getUsersBatchForWeeklyDigest(
      batchSize,
      lastCursor,
      qaEmail,
    );
  }

  /**
   * Fetch lightweight activity graph data.
   * Only queries the updates collection which is lightweight compared to workspace/collection scans.
   */
  private async fetchActivityGraph(
    start: Date,
    end: Date,
    prevStart: Date,
    prevEnd: Date,
  ): Promise<ActivityGraph> {
    const [activityData, prevActivityData] = await Promise.all([
      this.updatesRepository.getWeeklyActivity(start, end),
      this.updatesRepository.getWeeklyActivity(prevStart, prevEnd),
    ]);

    const dailyExecutions = this.formatWeeklyGraph(activityData);
    const totalExecutions = dailyExecutions.reduce((a, b) => a + b, 0);

    const prevDailyExecutions = this.formatWeeklyGraph(prevActivityData);
    const previousCount = prevDailyExecutions.reduce((a, b) => a + b, 0);

    let percentChange = 0;
    if (previousCount === 0 && totalExecutions > 0) {
      percentChange = 100;
    } else if (previousCount > 0) {
      percentChange = Math.round(
        ((totalExecutions - previousCount) / previousCount) * 100,
      );
    }

    const graphHeights = this.normalizeGraphData(dailyExecutions);
    const max = Math.max(...graphHeights);
    const graph = graphHeights.map((height) => ({
      height,
      isMax: height === max,
    }));

    return {
      totalExecutions,
      percentChange,
      graph,
    };
  }

  /**
   * Fetch per-user metrics for a batch of users using bulk aggregation queries.
   * Avoids heavy aggregation and uses O(1) lookups.
   * Avoids N+1 queries by fetching all data in bulk.
   */
  private async getMetricsForUserBatch(
    start: Date,
    end: Date,
    userIds: string[],
    emails: string[],
    users: WithId<User>[],
  ): Promise<Map<string, UserEmailData>> {
    // Compute weekStart once per batch using the repository helper
    const weekStart = this.userMetricsRepository.getWeekStart();

    // If userIds is very large, split into chunks to keep queries manageable
    const maxChunk = userIds.length > 1000 ? 800 : userIds.length;
    const chunks: string[][] = [];
    for (let i = 0; i < userIds.length; i += maxChunk) {
      chunks.push(userIds.slice(i, i + maxChunk));
    }

    // Fetch metrics for all users in the batch (may run multiple queries if chunked)
    const metricsPromises = chunks.map((chunk) =>
      this.userMetricsRepository.getMetricsForUsers(chunk, weekStart),
    );

    // Also fetch lightweight updates and invites in parallel
    const [metricsMapsArray, updatesMap, invitesMap] = await Promise.all([
      Promise.all(metricsPromises),
      this.updatesRepository.getUpdatesForBatch(start, end, userIds),
      this.userInvitesRepository.getPendingInvitesForBatch(start, end, emails),
    ]);

    // Merge chunked metrics maps into a single map
    const mergedMetricsMap = new Map<string, UserMetricsData>();
    for (const map of metricsMapsArray) {
      for (const [key, value] of map.entries()) {
        mergedMetricsMap.set(key, value);
      }
    }
    this.logger.log(
      `Fetched metrics for ${userIds.length} users (chunks: ${chunks.length})`,
    );

    const userEmailDataMap = new Map<string, UserEmailData>();

    for (const user of users) {
      if (user.isWeeklyDigestEnabled === false) continue;

      const userId = user._id.toString();
      const collaborationUpdates = updatesMap.get(userId) || [];
      const pendingActions = invitesMap.get(user.email) || [];

      const metricsData: UserMetricsData = mergedMetricsMap.get(userId) ?? {
        userId,
        weekStart,
        totalExecutions: 0,
        apisCreated: 0,
        collectionsCount: 0,
        activeWorkspaces: 0,
        newWorkspaces: 0,
        testflowsExecuted: 0,
        updatedAt: new Date(),
      };

      const metrics: UserMetrics = {
        activeWorkspaces: metricsData.activeWorkspaces || 0,
        newWorkspaces: metricsData.newWorkspaces || 0,
        collectionsCount: metricsData.collectionsCount || 0,
        apisCount: metricsData.apisCreated || 0,
        testflowExecutions: metricsData.testflowsExecuted || 0,
      };

      userEmailDataMap.set(userId, {
        user,
        metrics,
        collaborationUpdates,
        pendingActions,
      });
    }

    return userEmailDataMap;
  }

  /**
   * Send emails to a batch of users with controlled concurrency.
   * Uses a promise pool pattern to limit concurrent email sends.
   */
  private async sendEmailsBatch(
    userEmailDataMap: Map<string, UserEmailData>,
    activityGraph: ActivityGraph,
    start: Date,
    end: Date,
    concurrency: number,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();
    const senderEmail = this.configService.get("app.senderEmail");
    const appUrl = this.configService.get("app.url");

    const users = Array.from(userEmailDataMap.values());

    // Process emails with controlled concurrency using a promise pool
    await this.processWithConcurrency(
      users,
      concurrency,
      async (userData: UserEmailData) => {
        try {
          const { user, metrics, collaborationUpdates, pendingActions } =
            userData;

          const unsubscribeLink = `${appUrl}/api/user/unsubscribe-weekly-digest?userId=${user._id}`;

          const mailOptions = {
            from: senderEmail,
            to: user.email,
            template: "weeklyDigestEmail",
            subject: "Your Weekly Digest 📊",
            headers: {
              "List-Unsubscribe": `<${unsubscribeLink}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            context: {
              userName: user.name || user.email,
              dateRange: `${start.toDateString()} - ${end.toDateString()}`,
              // Activity graph is shared (lightweight global data)
              execution: {
                total: activityGraph.totalExecutions,
                percent: activityGraph.percentChange,
                graph: activityGraph.graph,
              },
              // Per-user metrics computed via batch aggregation
              metrics: {
                newWorkspaces: metrics.newWorkspaces,
                newCollections: metrics.collectionsCount,
                apisCreated: metrics.apisCount,
                testflowsExecuted: metrics.testflowExecutions,
                activeWorkspaces: metrics.activeWorkspaces,
              },
              ctaLink: "https://sparrowapp.dev",
              collaborationUpdates,
              pendingActions,
              unsubscribeLink,
            },
          };

          await this.emailService.sendEmail(transporter, mailOptions);
          this.logger.log(`Weekly digest sent to ${user.email}`);
        } catch (error) {
          this.logger.error(
            `Failed to send weekly digest to ${userData.user.email}: ${error.message}`,
          );
        }
      },
    );
  }

  /**
   * Process items with controlled concurrency using a promise pool pattern.
   * This ensures we don't overwhelm the email service with too many concurrent requests.
   */
  private async processWithConcurrency<T>(
    items: T[],
    concurrency: number,
    processor: (item: T) => Promise<void>,
  ): Promise<void> {
    const queue = [...items];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      // Fill up to concurrency limit
      while (executing.length < concurrency && queue.length > 0) {
        const item = queue.shift()!;
        const promise = processor(item).then(() => {
          executing.splice(executing.indexOf(promise), 1);
        });
        executing.push(promise);
      }

      // Wait for at least one to complete
      if (executing.length > 0) {
        await Promise.race(executing);
      }
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

  private normalizeGraphData(data: number[]) {
    const max = Math.max(...data, 1);

    return data.map((value) => {
      if (max === 0) return 12;

      const height = Math.round((value / max) * 40);
      return height < 10 ? 10 : height;
    });
  }

  private formatWeeklyGraph(data: any[]) {
    const result = Array(7).fill(0);

    data.forEach((item) => {
      const mongoDay = item._id;
      const index = (mongoDay + 5) % 7;
      result[index] = item.count;
    });

    return result;
  }
}
