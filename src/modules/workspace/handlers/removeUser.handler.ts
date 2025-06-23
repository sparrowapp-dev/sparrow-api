import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { WorkspaceUserService } from "../services/workspace-user.service";
import { ConsumerService } from "@src/modules/common/services/event-consumer.service";

@Injectable()
export class RemoveUserHandler implements OnModuleInit {
  constructor(
    private readonly workspaceUserService: WorkspaceUserService,
    private readonly consumerService: ConsumerService,
  ) {}

  async onModuleInit() {
    await this.consumerService.consume({
      topic: { topic: TOPIC.USER_REMOVED_FROM_TEAM_TOPIC },
      onMessage: async (message) => {
        const data = JSON.parse(message.value.toString());
        const workspaceArray = data.teamWorkspaces;
        const userId = data.userId;
        const role = data.role;
        await this.workspaceUserService.removeUserFromWorkspace(
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
