import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { SUBSCRIPTION } from "@src/modules/common/enum/subscription.enum";
import { WorkspaceUserService } from "../services/workspace-user.service";
import { ConsumerService } from "@src/modules/common/services/kafka/consumer.service";

@Injectable()
export class AddUserHandler implements OnModuleInit {
  constructor(
    private readonly workspaceUserService: WorkspaceUserService,
    private readonly consumerService: ConsumerService,
  ) {}

  async onModuleInit() {
    await this.consumerService.consume({
      topic: { topic: TOPIC.USER_ADDED_TO_TEAM_TOPIC },
      config: { groupId: SUBSCRIPTION.USER_ADDED_TO_TEAM_SUBSCRIPTION },
      onMessage: async (message) => {
        const data = JSON.parse(message.value.toString());
        const workspaceArray = data.teamWorkspaces;
        const userId = data.userId;
        const role = data.role;
        await this.workspaceUserService.addUserInWorkspace(
          workspaceArray,
          userId,
          role,
        );
      },
      onError: async (error) => {
        throw new BadRequestException(error);
      },
    });
  }
}
