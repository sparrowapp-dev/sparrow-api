import { Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult, WithId } from "mongodb";

// ---- Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";

// ---- Model
import { Updates } from "@src/modules/common/models/updates.model";

/**
 * Updates Repository
 */
@Injectable()
export class UpdatesRepository {
  /**
   * Constructor for Updates Repository.
   * @param db The MongoDB database connection injected by the NestJS dependency injection system.
   */
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Add update in the Updates collection.
   * @param update The update document to be inserted.
   * @returns Inserted document with ID.
   */
  async addUpdate(update: Updates): Promise<InsertOneResult<Updates>> {
    const response = await this.db
      .collection<Updates>(Collections.UPDATES)
      .insertOne(update);
    return response;
  }

  /**
   * Get paginated updates based on workspace ID.
   * @param workspaceId The workspace ID to filter updates.
   * @param skip Number of documents to skip.
   * @param limit Number of documents to fetch.
   * @returns Array of updates.
   */
  async getPaginatedUpdates(
    workspaceId: string,
    skip: number,
    limit: number,
  ): Promise<WithId<Updates>[]> {
    const query = { workspaceId };
    const resposne = this.db
      .collection<Updates>(Collections.UPDATES)
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    return resposne;
  }

  async getWeeklyActivity(start: Date, end: Date) {
    return this.db
      .collection(Collections.UPDATES)
      .aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: { $dayOfWeek: "$createdAt" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();
  }

  async getUpdatesForEmail(start: Date, end: Date, userId: string) {
    return this.db
      .collection(Collections.UPDATES)
      .find({
        createdAt: { $gte: start, $lte: end },
        createdBy: userId,
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
  }

  /**
   * Get updates for a batch of users using aggregation.
   * Returns updates grouped by userId for efficient batch processing.
   * @param start Start date range
   * @param end End date range
   * @param userIds Array of user IDs to fetch updates for
   * @returns Map of userId to array of update messages
   */
  async getUpdatesForBatch(
    start: Date,
    end: Date,
    userIds: string[],
  ): Promise<Map<string, string[]>> {
    const results = await this.db
      .collection(Collections.UPDATES)
      .aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            createdBy: { $in: userIds },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: "$createdBy",
            updates: { $push: "$message" },
          },
        },
        {
          $project: {
            _id: 1,
            updates: { $slice: ["$updates", 5] },
          },
        },
      ])
      .toArray();

    const updatesMap = new Map<string, string[]>();
    for (const result of results) {
      updatesMap.set(result._id, result.updates || []);
    }
    return updatesMap;
  }
}
