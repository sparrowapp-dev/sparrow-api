import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { SUBSCRIPTION } from "@src/modules/common/enum/subscription.enum";
import { WorkspaceUserService } from "../services/workspace-user.service";
import { ConsumerService } from "@src/modules/common/services/kafka/consumer.service";

@Injectable()
export class DemoteAdminHandler implements OnModuleInit {
  constructor(
    private readonly workspaceUserService: WorkspaceUserService,
    private readonly consumerService: ConsumerService,
  ) {}

  async onModuleInit() {
    await this.consumerService.consume({
      topic: { topic: TOPIC.TEAM_ADMIN_DEMOTED_TOPIC },
      config: { groupId: SUBSCRIPTION.TEAM_ADMIN_DEMOTED_SUBSCRIPTION },
      onMessage: async (message) => {
        const data = JSON.parse(message.value.toString());
        const workspaceArray = data.teamWorkspaces;
        const userId = data.userId;
        await this.workspaceUserService.demoteAdminInWorkspace(
          workspaceArray,
          userId,
        );
      },
      onError: async (error) => {
        throw new BadRequestException(error);
      },
    });
  }
}
