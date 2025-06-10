import { Injectable, Logger } from "@nestjs/common";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { Counter, Gauge } from "prom-client";
import { Cron, CronExpression } from "@nestjs/schedule";
import { UserMetricsRepository } from "../repositories/user-metrics.repository";
import {
  IUserMetricsService,
  IUserRequest,
  ITimeWindow,
} from "../interfaces/user-metrics.interface";

/**
 * Service for tracking and managing user metrics
 */
@Injectable()
export class UserMetricsService implements IUserMetricsService {
  private readonly logger = new Logger(UserMetricsService.name);
  private readonly environment = process.env.APP_ENV || "development";

  // Time windows for active user tracking
  private readonly timeWindows: ITimeWindow[] = [
    { name: "24h", durationMs: 24 * 60 * 60 * 1000 },
    { name: "7d", durationMs: 7 * 24 * 60 * 60 * 1000 },
    { name: "30d", durationMs: 30 * 24 * 60 * 60 * 1000 },
  ];

  constructor(
    private readonly userMetricsRepository: UserMetricsRepository,
    @InjectMetric("unique_users_total")
    private readonly uniqueUsersGauge: Gauge<string>,
    @InjectMetric("user_requests_total")
    private readonly userRequestsCounter: Counter<string>,
    @InjectMetric("active_users_current")
    private readonly activeUsersGauge: Gauge<string>,
  ) {}

  /**
   * Track user activity from a request
   */
  async trackUserActivity(
    userId: string,
    requestDetails: Partial<IUserRequest>,
  ): Promise<void> {
    try {
      // Update database record
      await this.userMetricsRepository.upsertUserActivity(
        userId,
        this.environment,
      );

      // Update Prometheus metrics
      this.userRequestsCounter.inc({
        user_id: userId,
        method: requestDetails.method || "UNKNOWN",
        origin: requestDetails.origin || "/unknown",
        status: requestDetails.status || "200",
        environment: this.environment,
      });

      this.logger.debug(`Tracked activity for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to track user activity for ${userId}:`, error);
    }
  }

  /**
   * Get total unique user count
   */
  async getUniqueUserCount(): Promise<number> {
    try {
      return await this.userMetricsRepository.getUniqueUserCount(
        this.environment,
      );
    } catch (error) {
      this.logger.error("Failed to get unique user count:", error);
      return 0;
    }
  }

  /**
   * Get active user count for a time window
   */
  async getActiveUserCount(timeWindowMs: number): Promise<number> {
    try {
      return await this.userMetricsRepository.getActiveUserCount(
        timeWindowMs,
        this.environment,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get active user count for window ${timeWindowMs}ms:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get request count for a specific user
   */
  async getUserRequestCount(userId: string): Promise<number> {
    try {
      return await this.userMetricsRepository.getUserRequestCount(
        userId,
        this.environment,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get request count for user ${userId}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Update all Prometheus metrics
   */
  async updateMetrics(): Promise<void> {
    try {
      // Update unique users count
      const uniqueUsers = await this.getUniqueUserCount();
      this.uniqueUsersGauge.set({ environment: this.environment }, uniqueUsers);

      // Update active users for different time windows
      for (const timeWindow of this.timeWindows) {
        const activeUsers = await this.getActiveUserCount(
          timeWindow.durationMs,
        );
        this.activeUsersGauge.set(
          {
            time_window: timeWindow.name,
            environment: this.environment,
          },
          activeUsers,
        );
      }

      this.logger.debug("Updated user metrics successfully");
    } catch (error) {
      this.logger.error("Failed to update metrics:", error);
    }
  }

  /**
   * Get comprehensive user statistics
   */
  async getUserStatistics(): Promise<{
    uniqueUsers: number;
    activeUsers24h: number;
    activeUsers7d: number;
    activeUsers30d: number;
    totalRequests: number;
    averageRequestsPerUser: number;
  }> {
    try {
      const [
        uniqueUsers,
        activeUsers24h,
        activeUsers7d,
        activeUsers30d,
        stats,
      ] = await Promise.all([
        this.getUniqueUserCount(),
        this.getActiveUserCount(this.timeWindows[0].durationMs),
        this.getActiveUserCount(this.timeWindows[1].durationMs),
        this.getActiveUserCount(this.timeWindows[2].durationMs),
        this.userMetricsRepository.getUserActivityStats(this.environment),
      ]);

      return {
        uniqueUsers,
        activeUsers24h,
        activeUsers7d,
        activeUsers30d,
        totalRequests: stats.totalRequests,
        averageRequestsPerUser: stats.averageRequestsPerUser,
      };
    } catch (error) {
      this.logger.error("Failed to get user statistics:", error);
      return {
        uniqueUsers: 0,
        activeUsers24h: 0,
        activeUsers7d: 0,
        activeUsers30d: 0,
        totalRequests: 0,
        averageRequestsPerUser: 0,
      };
    }
  }

  /**
   * Scheduled task to update metrics every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledMetricsUpdate(): Promise<void> {
    this.logger.debug("Running scheduled metrics update");
    await this.updateMetrics();
  }

  /**
   * Scheduled task to clean up old records (runs daily at 2 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledCleanup(): Promise<void> {
    try {
      // Clean up records older than 90 days
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const deletedCount =
        await this.userMetricsRepository.cleanupOldRecords(ninetyDaysMs);

      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old user activity records`);
      }
    } catch (error) {
      this.logger.error("Failed to clean up old records:", error);
    }
  }

  /**
   * Initialize metrics on service startup
   */
  async onModuleInit(): Promise<void> {
    this.logger.log("Initializing user metrics service");
    await this.updateMetrics();
  }
}
