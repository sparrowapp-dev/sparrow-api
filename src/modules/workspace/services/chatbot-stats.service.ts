import { Injectable } from "@nestjs/common";

// ---- Services
import { ContextService } from "@src/modules/common/services/context.service";

// ---- Models and Payloads
import {
  ChatbotFeedbackDto,
  TokenDto,
} from "../payloads/chatbot-stats.payload";
import { ChatbotFeedback } from "@src/modules/common/models/chatbot-stats.model";

// ---- Repository
import { ChatbotStatsRepository } from "../repositories/chatbot-stats.repositoy";

/**
 * Service for managing chatbot statistics such as token usage and feedback.
 */
@Injectable()
export class ChatbotStatsService {
  /**
   * Constructor for ChatbotStatsService.
   * @param contextService - Service to get context-related data like the current user.
   * @param chatbotStatsRepository - Repository to interact with the chatbot stats data store.
   */
  constructor(
    private readonly contextService: ContextService,
    private readonly chatbotStatsRepository: ChatbotStatsRepository,
  ) {}

  /**
   * Updates the token count for a given user.
   * @param payload - The data transfer object containing user ID and token count.
   * @returns A promise that resolves when the update is complete.
   */
  async updateToken(payload: TokenDto): Promise<void> {
    // Retrieve user stats by user ID
    const userStat = await this.chatbotStatsRepository.getStatsByUserID(
      payload.userId,
    );
    if (userStat) {
      // If stats exist, update the token count
      let token = userStat.tokenCount;
      token = payload.tokenCount + token;
      await this.chatbotStatsRepository.updateStats(userStat._id, {
        tokenCount: token,
      });
    } else {
      // if it doesn't exist, add the stat in DB.
      const stat = {
        userId: payload.userId,
        tokenCount: payload.tokenCount,
        createdAt: new Date(),
        createdBy: this.contextService.get("user")._id,
      };
      await this.chatbotStatsRepository.addStats(stat);
    }
  }

  /**
   * Updates the stat with the feedback and for a given user and message
   * @param payload - The data transfer object containing feedback details.
   * @returns A promise that resolves with the updated stats.
   */
  async updateFeedback(payload: ChatbotFeedbackDto) {
    const userId = this.contextService.get("user")._id;
    const userStat = await this.chatbotStatsRepository.getStatsByUserID(
      userId.toString(),
    );
    let feedback: ChatbotFeedback[];

    // Check if feedback already exists
    if (!userStat.feedback) {
      // If feedback does not exist, initialize it with the payload
      feedback = [{ ...payload }];
    } else {
      feedback = userStat.feedback;
      let found = false;

      // Iterate through the array to find the object with the given messageId
      feedback = feedback.map((obj) => {
        if (obj.messageId === payload.messageId) {
          obj.like = payload.like; // Update the like property
          found = true;
        }
        return obj;
      });
      // If the object was not found, add a new object to the array
      if (!found) {
        feedback.push({
          threadId: payload.threadId,
          messageId: payload.messageId,
          like: payload.like,
        });
      }
    }
    // Update the stats with the new feedback
    const response = await this.chatbotStatsRepository.updateStats(
      userStat._id,
      {
        feedback: feedback,
      },
    );
    return response;
  }
}
