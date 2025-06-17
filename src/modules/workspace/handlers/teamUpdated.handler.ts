import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
// ---- Enum
import { TOPIC } from "@src/modules/common/enum/topic.enum";
// ---- Services
import { ConsumerService } from "@src/modules/common/services/event-consumer.service";
import { WorkspaceService } from "../services/workspace.service";

@Injectable()
export class TeamUpdatedHandler implements OnModuleInit {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly consumerService: ConsumerService,
  ) {}

  /**
   * Initializes the module by subscribing to the NestJS Event topic that listens for team details updates.
   * When a message is received, it updates the team details in all related workspaces.
   *
   * @throws {BadRequestException} If an error occurs during message consumption or processing.
   */
  async onModuleInit() {
    // Set up the consumer to listen for messages from the TEAM_DETAILS_UPDATED_TOPIC NestJS Events topic
    await this.consumerService.consume({
      topic: { topic: TOPIC.TEAM_DETAILS_UPDATED_TOPIC },
      // Callback function executed when a message is received
      onMessage: async (message) => {
        const data = JSON.parse(message.value.toString());
        const teamId = data.teamId.toString();
        const teamName = data.teamName;
        const teamWorkspaces = data.teamWorkspaces;

        // Update the team details in the workspaces
        await this.workspaceService.updateTeamDetailsInWorkspace(
          teamId,
          teamName,
          teamWorkspaces,
        );
      },

      // Callback function executed when an error occurs
      onError: async (error) => {
        // Throw a BadRequestException on error
        throw new BadRequestException(error);
      },
    });
  }
}
