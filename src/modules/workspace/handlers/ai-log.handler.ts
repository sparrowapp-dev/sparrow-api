// ---- NestJS Native Imports
import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";

// ---- Enums
import { TOPIC } from "@src/modules/common/enum/topic.enum";

// ---- Services
import { ConsumerService } from "@src/modules/common/services/event-consumer.service";
import { AiLogService } from "../services/ai-log.service";

@Injectable()
export class AiLogHandler implements OnModuleInit {
  constructor(
    private readonly ailogService: AiLogService,
    private readonly consumerService: ConsumerService,
  ) {}

  /**
   * onModuleInit is called when the module is initialized.
   * It sets up a NestJS Event consumer to listen to the AI response generated topic and process messages.
   */
  async onModuleInit() {
    await this.consumerService.consume({
      topic: { topic: TOPIC.AI_ACTIVITY_LOG_TOPIC },
      onMessage: async (message) => {
        const data = JSON.parse(message.value.toString());
        const userId = data.userId.toString();
        const activity = data.activity.toString();
        const model = data.model.toString();
        const tokenConsumed = data.tokenConsumed;
        const thread_id = data.threadId.toString();
        await this.ailogService.addLog({
          userId,
          activity,
          model,
          tokenConsumed,
          thread_id,
        });
      },
      onError: async (error) => {
        throw new BadRequestException(error);
      },
    });
  }
}
