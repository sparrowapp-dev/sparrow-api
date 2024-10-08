import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { WorkspaceService } from "../services/workspace.service";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { ConsumerService } from "@src/modules/common/services/kafka/consumer.service";
import { SUBSCRIPTION } from "@src/modules/common/enum/subscription.enum";
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
      config: { groupId: SUBSCRIPTION.CREATE_USER_SUBSCRIPTION },
      onMessage: async (message) => {
        // This is a Hack for now, it needs to be rectified in future with any other method or library.
        setTimeout(async () => {
          const messageString = message.value.toString();
          const messageJson = JSON.parse(messageString);
          const workspace = await this.workspaceService.create(messageJson);
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
          );
          await this.workspaceService.addEnvironmentInWorkSpace(
            workspace.insertedId.toString(),
            {
              id: environment.insertedId,
              name: sampleEnvironment.name,
              type: EnvironmentType.LOCAL,
            },
          );
          // await this.collectionService.createCollection();
        }, this.configService.get("app.kafkaHitTimeInterval"));
      },
      onError: async (error) => {
        throw new BadRequestException(error);
      },
    });
  }
}
