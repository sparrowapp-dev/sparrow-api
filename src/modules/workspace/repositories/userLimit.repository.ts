import { Inject, Injectable } from "@nestjs/common";

import { Db, InsertOneResult } from "mongodb";

import { Collections } from "@src/modules/common/enum/database.collection.enum";

import { UserLimitLog } from "@src/modules/common/models/ai-limit.model";

/**
 * UserLimitRepository - Handles DB operations related to user usage limits.
 *
 *  Current Mode:
 *   - Logs and retrieves usage counts based on calendar months.
 *
 *  TODO Planned Refactor: 
 *   - Migrate to flexible date-range-based tracking (billing period).
 */

@Injectable()
export class UserLimitRepository {
  /**
   * Constructs the UserLimitRepository.
   *
   * @param {Db} db - MongoDB database instance.
   */
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Counts the number of requests made by a user in a specific team within a given date range.
   *
   * @param {string} userId - The user's ID.
   * @param {string} teamId - The team's ID.
   * @param {Date} start - The start date.
   * @param {Date} end - The end date.
   * @returns {Promise<number>} - The count of requests.
   */
  async countRequests(
    userId: string,
    teamId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    return await this.db
      .collection<UserLimitLog>(Collections.USERLIMITLOGS)
      .countDocuments({
        userId,
        teamId,
        requestedAt: { $gte: start, $lt: end },
      });
  }

  /**
   * Logs a new user request into the usage log collection.
   *
   * @param {UserLimitLog} log - Log data to be inserted.
   * @returns {Promise<InsertOneResult>} - The result of the insert operation.
   */
  async logRequest(log: UserLimitLog): Promise<InsertOneResult> {
    return await this.db
      .collection<UserLimitLog>(Collections.USERLIMITLOGS)
      .insertOne(log);
  }
}
