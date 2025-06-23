import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { WorkspaceService } from "../services/workspace.service";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { ConsumerService } from "@src/modules/common/services/event-consumer.service";
import { ConfigService } from "@nestjs/config";
import { CollectionService } from "../services/collection.service";
import { EnvironmentService } from "../services/environment.service";
import { EnvironmentType } from "@src/modules/common/models/environment.model";

@Injectable()
export class WorkspaceHandler implements OnModuleInit {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly consumerService: ConsumerService,
    private readonly configService: ConfigService,
    private readonly collectionService: CollectionService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async onModuleInit() {
    await this.consumerService.consume({
      topic: { topic: TOPIC.CREATE_USER_TOPIC },
      onMessage: async (message) => {
        // This is a Hack for now, it needs to be rectified in future with any other method or library.
        setTimeout(async () => {
          const messageString = message.value.toString();
          const messageJson = JSON.parse(messageString);
          let user = null;
          if (messageJson.user) {
            user = messageJson.user;
            delete messageJson.user;
          }
          const workspace = await this.workspaceService.create(
            messageJson,
            user,
          );
          // const teams = await this.teamService.getTeams();
          // for (const team of teams) {
          //   const matchedInvite = team?.invites?.find(
          //     (invite: any) =>
          //       invite.email === user.email && invite.isAccepted === true,
          //   );
          //   if (!matchedInvite) {
          //     continue;
          //   }

          //   await this.teamUserService.addUser({
          //     teamId: team._id.toString(),
          //     users: [matchedInvite.email],
          //     role: matchedInvite.role,
          //     workspaces: matchedInvite.workspaces,
          //   });
          // now remove it from invites array
          // await this.teamUserService.removeTeamInvite(
          //   team._id.toString(),
          //   user.email,
          // );
          // }
          const sampleEnvironment = {
            name: "Sample Environment",
            workspaceId: workspace.insertedId.toString(),
            variable: [
              {
                key: "DEV",
                value: "",
                checked: true,
              },
              {
                key: "",
                value: "",
                checked: false,
              },
            ],
          };
          const environment = await this.environmentService.createEnvironment(
            sampleEnvironment,
            EnvironmentType.LOCAL,
            user,
          );
          await this.workspaceService.addEnvironmentInWorkSpace(
            workspace.insertedId.toString(),
            {
              id: environment.insertedId,
              name: sampleEnvironment.name,
              type: EnvironmentType.LOCAL,
            },
            user,
          );
          const collection =
            await this.collectionService.createDefaultCollection(user);
          await this.workspaceService.addCollectionInWorkSpace(
            workspace.insertedId.toString(),
            { id: collection.insertedId, name: "Sample Collection" },
            user,
          );
        }, this.configService.get("app.kafkaHitTimeInterval"));
      },
      onError: async (error) => {
        throw new BadRequestException(error);
      },
    });
  }
}
