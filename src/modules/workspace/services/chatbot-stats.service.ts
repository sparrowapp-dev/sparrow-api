import { Injectable } from "@nestjs/common";
import { ObjectId, WithId } from "mongodb";

// ---- Services

// ---- Models and Payloads
import {
  ChatbotFeedbackDto,
  TokenDto,
} from "../payloads/chatbot-stats.payload";
import {
  ChatbotFeedback,
  ChatBotStats,
} from "@src/modules/common/models/chatbot-stats.model";

// ---- Repository
import { ChatbotStatsRepository } from "../repositories/chatbot-stats.repositoy";

/**
 * Service for managing chatbot statistics such as token usage and feedback.
 */
@Injectable()
export class ChatbotStatsService {
  /**
   * Constructor for ChatbotStatsService.
   * @param chatbotStatsRepository - Repository to interact with the chatbot stats data store.
   */
  constructor(
    private readonly chatbotStatsRepository: ChatbotStatsRepository,
  ) {}

  /**
   * Returns the current year and month in the format "YYYY-MM".
   *
   * @returns The current year and month as a string in the format "YYYY-MM".
   *
   * @example
   * // Returns "2024-10" for October 2024
   * const yearMonth = getCurrentYearMonth();
   */
  public getCurrentYearMonth = (): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Adding 1 because months are zero-indexed
    return `${year}-${month}`;
  };

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
    const currentYearMonth = this.getCurrentYearMonth();
    if (userStat) {
      // If stats exist, update the token count
      let token = userStat.tokenCount;
      let aiToken = payload.tokenCount;
      token = payload.tokenCount + token;
      const model = payload.model;
      // If current month update the monthly token usage
      if (
        userStat?.aiModel &&
        userStat?.aiModel?.yearMonth === currentYearMonth
      ) {
        if (model === "gpt") {
          aiToken = userStat.aiModel.gpt + aiToken;
        } else if (model === "deepseek") {
          aiToken = userStat.aiModel.deepseek + aiToken;
        }
      }
      await this.chatbotStatsRepository.updateStats(
        userStat._id,
        {
          tokenCount: token,
          aiModel: {
            yearMonth: currentYearMonth,
            gpt: payload.model === "gpt" ? aiToken : userStat.aiModel.gpt,
            deepseek:
              payload.model === "deepseek"
                ? aiToken
                : userStat.aiModel.deepseek,
          },
        },
        payload.userId,
      );
    } else {
      // if it doesn't exist, add the stat in DB.
      const stat = {
        userId: payload.userId,
        tokenCount: payload.tokenCount,
        tokenStats: {
          yearMonth: currentYearMonth,
          tokenUsage: payload.tokenCount,
        },
        aiModel: {
          yearMonth: currentYearMonth,
          gpt: payload.model === "gpt" ? payload.tokenCount : 0,
          deepseek: payload.model === "deepseek" ? payload.tokenCount : 0,
        },
        createdAt: new Date(),
        createdBy: payload.userId,
      };
      await this.chatbotStatsRepository.addStats(stat);
    }
  }

  /**
   * Updates the stat with the feedback and for a given user and message
   * @param payload - The data transfer object containing feedback details.
   * @returns A promise that resolves with the updated stats.
   */
  async updateFeedback(payload: ChatbotFeedbackDto, currentUserId: ObjectId) {
    const userStat = await this.chatbotStatsRepository.getStatsByUserID(
      currentUserId.toString(),
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

  /**
   * Retrieves the chatbot statistics for an individual user by their user ID.
   *
   * @param {string} userId - The unique identifier of the user whose statistics are to be retrieved.
   * @returns Chatbot statistics for the given user.
   */
  async getIndividualStat(userId: string): Promise<WithId<ChatBotStats>> {
    const stat = await this.chatbotStatsRepository.getStatsByUserID(userId);
    return stat;
  }
}
