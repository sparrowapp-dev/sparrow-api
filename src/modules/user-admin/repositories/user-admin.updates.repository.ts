import { Injectable, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db, ObjectId } from "mongodb";

@Injectable()
export class AdminUpdatesRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Get activities for users in the admin's teams - simple database query
   */
  async findUpdates(
    query: any,
    page: number,
    limit: number,
  ): Promise<{ updates: any[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      // Convert string parameters to numbers to ensure they work correctly
      const numericLimit = Number(limit);
      const numericSkip = Number(skip);

      // Count total matching documents
      const total = await this.db
        .collection(Collections.UPDATES)
        .countDocuments(query);

      // Get updates with pagination
      const updates = await this.db
        .collection(Collections.UPDATES)
        .find(query)
        .sort({ createdAt: -1 })
        .skip(numericSkip)
        .limit(numericLimit)
        .toArray();

      return { updates, total };
    } catch (error) {
      console.error("Error finding updates:", error);
      throw error;
    }
  }
}
