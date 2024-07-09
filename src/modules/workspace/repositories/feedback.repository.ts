import { Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult } from "mongodb";

// ---- Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";

// ---- Model
import { Feedback } from "@src/modules/common/models/feedback.model";

/**
 * Feedback Repository
 */
@Injectable()
export class FeedbackRepository {
  /**
   * Constructor for Feedback Repository.
   * @param db The MongoDB database connection injected by the NestJS dependency injection system.
   */
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Add feedback in the Feedback collection.
   * @param feedback The feedback document to be inserted.
   * @returns Inserted document ID.
   */
  async addFeedback(feedback: Feedback): Promise<InsertOneResult<Feedback>> {
    const response = await this.db
      .collection<Feedback>(Collections.FEEDBACK)
      .insertOne(feedback);
    return response;
  }
}
