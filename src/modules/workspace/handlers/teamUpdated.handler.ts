import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { SUBSCRIPTION } from "@src/modules/common/enum/subscription.enum";
import { ConsumerService } from "@src/modules/common/services/kafka/consumer.service";
import { WorkspaceService } from "../services/workspace.service";

@Injectable()
export class TeamUpdatedHandler implements OnModuleInit {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly consumerService: ConsumerService,
  ) {}

  async onModuleInit() {
    await this.consumerService.consume({
      topic: { topic: TOPIC.TEAM_DETAILS_UPDATED_TOPIC },
      config: { groupId: SUBSCRIPTION.TEAM_DETAILS_UPDATED_SUBSCRIPTION },
      onMessage: async (message) => {
        const data = JSON.parse(message.value.toString());
        const teamId = data.teamId.toString();
        const teamName = data.teamName;
        const teamWorkspaces = data.teamWorkspaces;
        await this.workspaceService.updateTeamDetailsInWorkspace(
          teamId,
          teamName,
          teamWorkspaces,
        );
      },
      onError: async (error) => {
        throw new BadRequestException(error);
      },
    });
  }
}
