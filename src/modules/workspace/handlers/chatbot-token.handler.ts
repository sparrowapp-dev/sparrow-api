// ---- NestJS Native Imports
import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";

// ---- Enums
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { SUBSCRIPTION } from "@src/modules/common/enum/subscription.enum";

// ---- Services
import { ConsumerService } from "@src/modules/common/services/kafka/consumer.service";
import { ChatbotStatsService } from "../services/chatbot-stats.service";

/**
 * ChatbotTokenHandler class is responsible for handling token updates for chatbot responses.
 * It implements the OnModuleInit interface to initialize Kafka consumers on module initialization.
 * This handler consumes AI_RESPONSE_GENERATED_TOPIC.
 */
@Injectable()
export class ChatbotTokenHandler implements OnModuleInit {
  /**
   * Constructor to initialize ChatbotTokenHandler with required services.
   * @param chatbotStatsService - Service to handle chatbot statistics updates.
   * @param consumerService - Kafka consumer service to consume messages from Kafka topics.
   */
  constructor(
    private readonly chatbotStatsService: ChatbotStatsService,
    private readonly consumerService: ConsumerService,
  ) {}

  /**
   * onModuleInit is called when the module is initialized.
   * It sets up a Kafka consumer to listen to the AI response generated topic and process messages.
   */
  async onModuleInit() {
    await this.consumerService.consume({
      topic: { topic: TOPIC.AI_RESPONSE_GENERATED_TOPIC },
      config: { groupId: SUBSCRIPTION.AI_RESPONSE_GENERATED_SUBSCRIPTION },
      onMessage: async (message) => {
        const data = JSON.parse(message.value.toString());
        const tokenCount = data.tokenCount;
        const userId = data.userId.toString();
        await this.chatbotStatsService.updateToken({ userId, tokenCount });
      },
      onError: async (error) => {
        throw new BadRequestException(error);
      },
    });
  }
}
