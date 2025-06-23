import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
// ---- Enums
import { TOPIC } from "@src/modules/common/enum/topic.enum";

// ---- Services
import { ConsumerService } from "@src/modules/common/services/event-consumer.service";
import { UpdatesService } from "../services/updates.service";
/**
 * UpdatesHandler class handles NestJS Events messages related to updates.
 */
@Injectable()
export class UpdatesHandler implements OnModuleInit {
  /**
   * Constructor to initialize UpdatesHandler with the required services.
   * @param updatesService - Injected UpdatesService to handle business logic.
   * @param consumerService - Injected ConsumerService to handle NestJS Events consumption.
   */
  constructor(
    private readonly updatesService: UpdatesService,
    private readonly consumerService: ConsumerService,
  ) {}

  /**
   * Initializes the UpdatesHandler module and starts consuming NestJS Events messages.
   */
  async onModuleInit() {
    await this.consumerService.consume({
      topic: { topic: TOPIC.UPDATES_ADDED_TOPIC },
      onMessage: async (message) => {
        const data = JSON.parse(message.value.toString());
        let user = null;
        if (data.user) {
          user = data.user;
          delete data.user;
        }
        const type = data.type;
        const updateMessage = data.message;
        const workspaceId = data.workspaceId;
        await this.updatesService.addUpdate(
          {
            type,
            message: updateMessage,
            workspaceId,
          },
          user,
        );
      },
      onError: async (error) => {
        throw new BadRequestException(error);
      },
    });
  }
}
