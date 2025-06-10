import { Injectable, Inject } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import {
  IUserActivity,
  IUserMetricsSummary,
  IUserRequest,
} from "../interfaces/user-metrics.interface";

/**
 * Repository for user metrics data operations
 */
@Injectable()
export class UserMetricsRepository {
  private readonly USER_ACTIVITY_COLLECTION = "user_activity";
  private readonly USER_METRICS_SUMMARY_COLLECTION = "user_metrics_summary";

  constructor(
    @Inject("DATABASE_CONNECTION")
    private readonly db: Db,
  ) {}

  /**
   * Update or create user activity record
   */
  async upsertUserActivity(userId: string, environment: string): Promise<void> {
    const now = new Date();

    await this.db.collection(this.USER_ACTIVITY_COLLECTION).updateOne(
      { userId, environment },
      {
        $set: {
          lastActiveAt: now,
        },
        $inc: {
          requestCount: 1,
        },
        $setOnInsert: {
          firstSeenAt: now,
        },
      },
      { upsert: true },
    );
  }

  /**
   * Get total unique user count
   */
  async getUniqueUserCount(environment?: string): Promise<number> {
    const filter = environment ? { environment } : {};
    return await this.db
      .collection(this.USER_ACTIVITY_COLLECTION)
      .countDocuments(filter);
  }

  /**
   * Get count of users active within a time window
   */
  async getActiveUserCount(
    timeWindowMs: number,
    environment?: string,
  ): Promise<number> {
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    const filter: any = {
      lastActiveAt: { $gte: cutoffTime },
    };

    if (environment) {
      filter.environment = environment;
    }

    return await this.db
      .collection(this.USER_ACTIVITY_COLLECTION)
      .countDocuments(filter);
  }

  /**
   * Get request count for a specific user
   */
  async getUserRequestCount(
    userId: string,
    environment?: string,
  ): Promise<number> {
    const filter: any = { userId };
    if (environment) {
      filter.environment = environment;
    }

    const userActivity = await this.db
      .collection(this.USER_ACTIVITY_COLLECTION)
      .findOne(filter);
    return userActivity?.requestCount || 0;
  }

  /**
   * Get all user activities for metrics calculation
   */
  async getAllUserActivities(environment?: string): Promise<IUserActivity[]> {
    const filter = environment ? { environment } : {};
    return (await this.db
      .collection(this.USER_ACTIVITY_COLLECTION)
      .find(filter)
      .toArray()) as IUserActivity[];
  }

  /**
   * Save metrics summary
   */
  async saveMetricsSummary(summary: IUserMetricsSummary): Promise<void> {
    await this.db.collection(this.USER_METRICS_SUMMARY_COLLECTION).insertOne({
      ...summary,
      timestamp: new Date(),
    });
  }

  /**
   * Get latest metrics summary
   */
  async getLatestMetricsSummary(
    environment?: string,
  ): Promise<IUserMetricsSummary | null> {
    const filter = environment ? { environment } : {};
    return (await this.db
      .collection(this.USER_METRICS_SUMMARY_COLLECTION)
      .findOne(filter, {
        sort: { timestamp: -1 },
      })) as unknown as IUserMetricsSummary | null;
  }

  /**
   * Clean up old user activity records (optional maintenance)
   */
  async cleanupOldRecords(olderThanMs: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanMs);
    const result = await this.db
      .collection(this.USER_ACTIVITY_COLLECTION)
      .deleteMany({
        lastActiveAt: { $lt: cutoffTime },
      });
    return result.deletedCount || 0;
  }

  /**
   * Get user activity statistics
   */
  async getUserActivityStats(environment?: string): Promise<{
    totalUsers: number;
    totalRequests: number;
    averageRequestsPerUser: number;
  }> {
    const filter = environment ? { environment } : {};

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: null as any,
          totalUsers: { $sum: 1 },
          totalRequests: { $sum: "$requestCount" },
          averageRequestsPerUser: { $avg: "$requestCount" },
        },
      },
    ];

    const result = await this.db
      .collection(this.USER_ACTIVITY_COLLECTION)
      .aggregate(pipeline)
      .toArray();

    if (result.length === 0) {
      return {
        totalUsers: 0,
        totalRequests: 0,
        averageRequestsPerUser: 0,
      };
    }

    return {
      totalUsers: result[0].totalUsers,
      totalRequests: result[0].totalRequests,
      averageRequestsPerUser:
        Math.round(result[0].averageRequestsPerUser * 100) / 100,
    };
  }
}
