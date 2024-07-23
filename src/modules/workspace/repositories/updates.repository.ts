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
}
