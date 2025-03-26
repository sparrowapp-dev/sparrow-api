import { Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult, ObjectId, UpdateResult } from "mongodb";

// ---- Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";

// ---- Model
import { ChatBotStats } from "@src/modules/common/models/chatbot-stats.model";

// ---- Payload
import { UpdateChatbotDto } from "../payloads/chatbot-stats.payload";

// ---- Services
import { ContextService } from "@src/modules/common/services/context.service";

/**
 * ChatbotStatsRepository
 *
 * Repository class for handling chatbot statistics related operations with MongoDB.
 */
@Injectable()
export class ChatbotStatsRepository {
  /**
   * Constructor for ChatbotStatsRepository.
   * @param db The MongoDB database connection injected by the NestJS dependency injection system.
   * @param contextService The service for accessing context-related information like the current user.
   */
  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Add a new statistics entry in the chatbot stats collection.
   * @param chatbotstats The chatbotstats document to be inserted.
   * @returns The result of the insertion, including the ID of the inserted document.
   */
  async addStats(
    chatbotstats: ChatBotStats,
  ): Promise<InsertOneResult<ChatBotStats>> {
    const response = await this.db
      .collection<ChatBotStats>(Collections.CHATBOTSTATS)
      .insertOne(chatbotstats);
    return response;
  }

  /**
   * Retrieve statistics by user ID.
   * @param userId The ID of the user whose statistics are to be retrieved.
   * @returns The statistics document associated with the given user ID.
   */
  async getStatsByUserID(userId: string) {
    const data = await this.db
      .collection<ChatBotStats>(Collections.CHATBOTSTATS)
      .findOne({ userId });
    return data;
  }

  /**
   * Update statistics for a given document ID.
   * @param id The ObjectId of the document to be updated.
   * @param payload The stats data to update the document with.
   * @returns The result of the update operation.
   */
  async updateStats(
    id: ObjectId,
    payload: UpdateChatbotDto,
    userId: string = null,
  ): Promise<UpdateResult> {
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: this.contextService.get("user")?._id ?? userId,
    };
    const data = await this.db
      .collection(Collections.CHATBOTSTATS)
      .updateOne({ _id: id }, { $set: { ...payload, ...defaultParams } });
    return data;
  }
}
