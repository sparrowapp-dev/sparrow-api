import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { WorkspaceService } from "../services/workspace.service";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { ConsumerService } from "@src/modules/common/services/kafka/consumer.service";
import { SUBSCRIPTION } from "@src/modules/common/enum/subscription.enum";

@Injectable()
export class WorkspaceHandler implements OnModuleInit {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly consumerService: ConsumerService,
  ) {}

  async onModuleInit() {
    await this.consumerService.consume({
      topic: { topic: TOPIC.CREATE_USER_TOPIC },
      config: { groupId: SUBSCRIPTION.CREATE_USER_SUBSCRIPTION },
      onMessage: async (message) => {
        await this.workspaceService.create(
          JSON.parse(message.value.toString()),
        );
      },
      onError: async (error) => {
        throw new BadRequestException(error);
      },
    });
  }
}
