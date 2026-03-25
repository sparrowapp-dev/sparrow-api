import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Db, WithId, BulkWriteResult } from "mongodb";

// ---- Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";

// ---- Model
import {
  UserMetrics,
  IncrementMetricsPayload,
  UserMetricsData,
} from "@src/modules/common/models/user-metrics.model";

/**
 * UserMetrics Repository
 * Handles precomputed weekly digest metrics for efficient email generation.
 * Designed for millions of users with bulk operations and proper indexing.
 */
@Injectable()
export class UserMetricsRepository implements OnModuleInit {
  private readonly logger = new Logger(UserMetricsRepository.name);

  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Initialize indexes on module startup.
   * Creates compound index on { userId: 1, weekStart: 1 } for efficient lookups.
   */
  async onModuleInit(): Promise<void> {
    try {
      const collection = this.db.collection(Collections.USER_METRICS);

      // Create compound index for userId + weekStart (unique per user per week)
      await collection.createIndex(
        { userId: 1, weekStart: 1 },
        { unique: true, background: true },
      );

      await collection.createIndex(
        { weekStart: 1, userId: 1 },
        { background: true },
      );

      // Create index on weekStart for cleanup/maintenance queries
      await collection.createIndex({ weekStart: 1 }, { background: true });

      // Create index on updatedAt for maintenance queries
      await collection.createIndex({ updatedAt: 1 }, { background: true });

      // Create unique index for daily metrics (user + date)
      await this.db
        .collection(Collections.USER_METRICS + "_daily")
        .createIndex(
          { userId: 1, date: 1 },
          { unique: true, background: true },
        );

      this.logger.log("UserMetrics indexes created successfully");
    } catch (error) {
      this.logger.error("Failed to create UserMetrics indexes", error);
    }
  }

  /**
   * Get the start of the current week (Monday 00:00:00 UTC).
   * Used to normalize weekStart for consistent grouping.
   */
  getWeekStart(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    // Adjust to Monday (day 1), if Sunday (day 0), go back 6 days
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Increment metrics for a single user using upsert.
   * Uses $inc for atomic increments, creating the document if it doesn't exist.
   *
   * @param userId The user ID to update metrics for
   * @param weekStart The start of the week for this metric
   * @param payload Partial metrics to increment
   */
  async incrementMetrics(
    userId: string,
    weekStart: Date,
    payload: IncrementMetricsPayload,
  ): Promise<void> {
    const incPayload: Record<string, number> = {};

    if (payload.totalExecutions !== undefined) {
      incPayload.totalExecutions = payload.totalExecutions;
    }
    if (payload.apisCreated !== undefined) {
      incPayload.apisCreated = payload.apisCreated;
    }
    if (payload.collectionsCount !== undefined) {
      incPayload.collectionsCount = payload.collectionsCount;
    }
    if (payload.activeWorkspaces !== undefined) {
      incPayload.activeWorkspaces = payload.activeWorkspaces;
    }
    if (payload.testflowsExecuted !== undefined) {
      incPayload.testflowsExecuted = payload.testflowsExecuted;
    }
    if (payload.newWorkspaces !== undefined) {
      incPayload.newWorkspaces = payload.newWorkspaces;
    }

    // Skip if no metrics to increment
    if (Object.keys(incPayload).length === 0) {
      return;
    }

    await this.db.collection<UserMetrics>(Collections.USER_METRICS).updateOne(
      { userId, weekStart },
      {
        $inc: incPayload,
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          userId,
          weekStart,
        },
      },
      { upsert: true },
    );
  }

  /**
   * Bulk increment metrics for multiple users.
   * Uses bulkWrite for efficient batch operations.
   * Merges operations for the same userId to reduce DB writes.
   *
   * @param operations Array of { userId, payload } to increment
   * @param weekStart The start of the week for these metrics
   */
  async bulkIncrementMetrics(
    operations: Array<{ userId: string; payload: IncrementMetricsPayload }>,
    weekStart: Date,
  ): Promise<BulkWriteResult> {
    if (operations.length === 0) {
      return {
        ok: 1,
        insertedCount: 0,
        matchedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        upsertedCount: 0,
        insertedIds: {},
        upsertedIds: {},
      } as BulkWriteResult;
    }

    // Merge operations by userId to reduce redundant DB writes
    const mergedOps = this.mergeOperationsByUserId(operations);
    this.logger.log(
      `UserMetrics bulk merge: ${operations.length} → ${mergedOps.size}`,
    );

    const bulkOps = Array.from(mergedOps.entries()).map(([userId, payload]) => {
      const incPayload: Record<string, number> = {};

      if (payload.totalExecutions !== undefined) {
        incPayload.totalExecutions = payload.totalExecutions;
      }
      if (payload.apisCreated !== undefined) {
        incPayload.apisCreated = payload.apisCreated;
      }
      if (payload.collectionsCount !== undefined) {
        incPayload.collectionsCount = payload.collectionsCount;
      }
      if (payload.activeWorkspaces !== undefined) {
        incPayload.activeWorkspaces = payload.activeWorkspaces;
      }
      if (payload.testflowsExecuted !== undefined) {
        incPayload.testflowsExecuted = payload.testflowsExecuted;
      }
      if (payload.newWorkspaces !== undefined) {
        incPayload.newWorkspaces = payload.newWorkspaces;
      }

      return {
        updateOne: {
          filter: { userId, weekStart },
          update: {
            $inc: incPayload,
            $set: { updatedAt: new Date() },
            $setOnInsert: {
              userId,
              weekStart,
            },
          },
          upsert: true,
        },
      };
    });

    return await this.db
      .collection<UserMetrics>(Collections.USER_METRICS)
      .bulkWrite(bulkOps, { ordered: false });
  }

  /**
   * Bulk increment daily execution counts for users.
   * Expects operations as array of { userId, totalExecutions }
   */
  async bulkIncrementDailyMetrics(
    operations: Array<{ userId: string; totalExecutions: number }>,
  ): Promise<BulkWriteResult | null> {
    if (!operations || operations.length === 0) return null;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const bulkOps = operations.map(({ userId, totalExecutions }) => ({
      updateOne: {
        filter: { userId, date: today },
        update: {
          $inc: { totalExecutions: totalExecutions || 0 },
          $setOnInsert: { userId, date: today },
        },
        upsert: true,
      },
    }));

    // Use the daily collection name derived from USER_METRICS
    return await this.db
      .collection(Collections.USER_METRICS + "_daily")
      .bulkWrite(bulkOps as any, { ordered: false });
  }

  /**
   * Merge multiple operations for the same userId by summing their payloads.
   * Reduces redundant DB operations for high-frequency events.
   *
   * @param operations Array of operations to merge
   * @returns Map of userId to merged IncrementMetricsPayload
   */
  private mergeOperationsByUserId(
    operations: Array<{ userId: string; payload: IncrementMetricsPayload }>,
  ): Map<string, IncrementMetricsPayload> {
    const merged = new Map<string, IncrementMetricsPayload>();

    for (const { userId, payload } of operations) {
      const existing = merged.get(userId);

      if (!existing) {
        // Clone the payload to avoid mutating the original
        merged.set(userId, { ...payload });
      } else {
        // Sum all numeric fields
        if (payload.totalExecutions !== undefined) {
          existing.totalExecutions =
            (existing.totalExecutions || 0) + payload.totalExecutions;
        }
        if (payload.apisCreated !== undefined) {
          existing.apisCreated =
            (existing.apisCreated || 0) + payload.apisCreated;
        }
        if (payload.collectionsCount !== undefined) {
          existing.collectionsCount =
            (existing.collectionsCount || 0) + payload.collectionsCount;
        }
        if (payload.activeWorkspaces !== undefined) {
          existing.activeWorkspaces =
            (existing.activeWorkspaces || 0) + payload.activeWorkspaces;
        }
        if (payload.testflowsExecuted !== undefined) {
          existing.testflowsExecuted =
            (existing.testflowsExecuted || 0) + payload.testflowsExecuted;
        }
        if (payload.newWorkspaces !== undefined) {
          existing.newWorkspaces =
            (existing.newWorkspaces || 0) + payload.newWorkspaces;
        }
      }
    }

    return merged;
  }

  /**
   * Get metrics for multiple users for a specific week.
   * Returns a Map for O(1) lookup by userId.
   *
   * @param userIds Array of user IDs to fetch metrics for
   * @param weekStart The start of the week to fetch metrics for
   * @returns Map of userId to UserMetricsData
   */
  async getMetricsForUsers(
    userIds: string[],
    weekStart: Date,
  ): Promise<Map<string, UserMetricsData>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const results = await this.db
      .collection<UserMetrics>(Collections.USER_METRICS)
      .find(
        {
          userId: { $in: userIds },
          weekStart,
        },
        {
          projection: {
            userId: 1,
            weekStart: 1,
            totalExecutions: 1,
            apisCreated: 1,
            collectionsCount: 1,
            activeWorkspaces: 1,
            newWorkspaces: 1,
            testflowsExecuted: 1,
            updatedAt: 1,
          },
        },
      )
      .toArray();

    const metricsMap = new Map<string, UserMetricsData>();

    for (const result of results) {
      metricsMap.set(result.userId, {
        userId: result.userId,
        weekStart: result.weekStart,
        totalExecutions: result.totalExecutions || 0,
        apisCreated: result.apisCreated || 0,
        collectionsCount: result.collectionsCount || 0,
        activeWorkspaces: result.activeWorkspaces || 0,
        newWorkspaces: result.newWorkspaces || 0,
        testflowsExecuted: result.testflowsExecuted || 0,
        updatedAt: result.updatedAt || new Date(),
      });
    }

    return metricsMap;
  }

  /**
   * Get daily metrics for multiple users between date range.
   * Returns raw documents with { userId, date, totalExecutions }
   */
  async getDailyMetricsForUsers(
    userIds: string[],
    from: Date,
    to: Date,
  ): Promise<Array<{ userId: string; date: Date; totalExecutions: number }>> {
    if (!userIds || userIds.length === 0) return [];

    const results = await this.db
      .collection(Collections.USER_METRICS + "_daily")
      .find(
        {
          userId: { $in: userIds },
          date: { $gte: from, $lte: to },
        },
        {
          projection: { userId: 1, date: 1, totalExecutions: 1 },
        },
      )
      .toArray();

    return results.map((r: any) => ({
      userId: r.userId,
      date: r.date,
      totalExecutions: r.totalExecutions || 0,
    }));
  }

  /**
   * Get metrics for a single user for a specific week.
   *
   * @param userId The user ID to fetch metrics for
   * @param weekStart The start of the week to fetch metrics for
   * @returns UserMetricsData or null if not found
   */
  async getMetricsForUser(
    userId: string,
    weekStart: Date,
  ): Promise<UserMetricsData | null> {
    const result = await this.db
      .collection<UserMetrics>(Collections.USER_METRICS)
      .findOne(
        { userId, weekStart },
        {
          projection: {
            userId: 1,
            weekStart: 1,
            totalExecutions: 1,
            apisCreated: 1,
            collectionsCount: 1,
            activeWorkspaces: 1,
            testflowsExecuted: 1,
            updatedAt: 1,
          },
        },
      );

    if (!result) {
      return null;
    }

    return {
      userId: result.userId,
      weekStart: result.weekStart,
      totalExecutions: result.totalExecutions || 0,
      apisCreated: result.apisCreated || 0,
      collectionsCount: result.collectionsCount || 0,
      activeWorkspaces: result.activeWorkspaces || 0,
      newWorkspaces: result.newWorkspaces || 0,
      testflowsExecuted: result.testflowsExecuted || 0,
      updatedAt: result.updatedAt || new Date(),
    };
  }

  /**
   * Set absolute metric values for a user (not increment).
   * Useful for recalculating/resetting metrics.
   *
   * @param userId The user ID to set metrics for
   * @param weekStart The start of the week for this metric
   * @param metrics The metrics to set
   */
  async setMetrics(
    userId: string,
    weekStart: Date,
    metrics: Partial<IncrementMetricsPayload>,
  ): Promise<void> {
    const setPayload: Record<string, number | Date> = {
      updatedAt: new Date(),
    };

    if (metrics.totalExecutions !== undefined) {
      setPayload.totalExecutions = metrics.totalExecutions;
    }
    if (metrics.apisCreated !== undefined) {
      setPayload.apisCreated = metrics.apisCreated;
    }
    if (metrics.collectionsCount !== undefined) {
      setPayload.collectionsCount = metrics.collectionsCount;
    }
    if (metrics.activeWorkspaces !== undefined) {
      setPayload.activeWorkspaces = metrics.activeWorkspaces;
    }
    if (metrics.newWorkspaces !== undefined) {
      setPayload.newWorkspaces = metrics.newWorkspaces;
    }
    if (metrics.testflowsExecuted !== undefined) {
      setPayload.testflowsExecuted = metrics.testflowsExecuted;
    }

    await this.db.collection<UserMetrics>(Collections.USER_METRICS).updateOne(
      { userId, weekStart },
      {
        $set: setPayload,
        $setOnInsert: {
          userId,
          weekStart,
          totalExecutions: 0,
          apisCreated: 0,
          collectionsCount: 0,
          activeWorkspaces: 0,
          testflowsExecuted: 0,
        },
      },
      { upsert: true },
    );
  }

  /**
   * Delete old metrics to prevent unbounded growth.
   * Should be called periodically (e.g., weekly cleanup job).
   *
   * @param olderThan Delete metrics older than this date
   * @returns Number of documents deleted
   */
  async cleanupOldMetrics(olderThan: Date): Promise<number> {
    const result = await this.db
      .collection<UserMetrics>(Collections.USER_METRICS)
      .deleteMany({ weekStart: { $lt: olderThan } });

    this.logger.log(`Cleaned up ${result.deletedCount} old user metrics`);
    return result.deletedCount;
  }
}
