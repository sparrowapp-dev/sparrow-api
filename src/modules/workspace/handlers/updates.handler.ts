import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
// ---- Enums
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { SUBSCRIPTION } from "@src/modules/common/enum/subscription.enum";

// ---- Services
import { ConsumerService } from "@src/modules/common/services/kafka/consumer.service";
import { UpdatesService } from "../services/updates.service";
/**
 * UpdatesHandler class handles Kafka messages related to updates.
 */
@Injectable()
export class UpdatesHandler implements OnModuleInit {
  /**
   * Constructor to initialize UpdatesHandler with the required services.
   * @param updatesService - Injected UpdatesService to handle business logic.
   * @param consumerService - Injected ConsumerService to handle Kafka consumption.
   */
  constructor(
    private readonly updatesService: UpdatesService,
    private readonly consumerService: ConsumerService,
  ) {}

  /**
   * Initializes the UpdatesHandler module and starts consuming Kafka messages.
   */
  async onModuleInit() {
    await this.consumerService.consume({
      topic: { topic: TOPIC.UPDATES_ADDED_TOPIC },
      config: { groupId: SUBSCRIPTION.UPDATES_ADDED_SUBSCRIPTION },
      onMessage: async (message) => {
        const data = JSON.parse(message.value.toString());
        const type = data.type;
        const updateMessage = data.message;
        const workspaceId = data.workspaceId;
        await this.updatesService.addUpdate({
          type,
          message: updateMessage,
          workspaceId,
        });
      },
      onError: async (error) => {
        throw new BadRequestException(error);
      },
    });
  }
}
