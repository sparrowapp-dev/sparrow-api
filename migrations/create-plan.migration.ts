import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { LimitArea } from "@src/modules/common/models/plan.model";

import { Db } from "mongodb";

@Injectable()
export class CreatePlanMigration implements OnModuleInit {
  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db, // Inject the MongoDB connection
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const defaultHubPlan =
        this.configService.get<string>("app.defaultHubPlan");
      const planCollection = this.db.collection(Collections.PLAN);

      const existingPlan = await planCollection.findOne({
        name: defaultHubPlan,
      });

      if (!existingPlan) {
        const plan = {
          name: defaultHubPlan,
          description: "Free tier with limited access",
          active: true,
          limits: { 
            workspacesPerHub: {
              area: LimitArea.WORKSPACE,
              value: 3,
            },
            testflowPerWorkspace: {
              area: LimitArea.TESTFLOW,
              value: 3,
            },
            blocksPerTestflow: {
              area: LimitArea.BLOCK,
              value: 5,
            },
            usersPerHub:{
              area: LimitArea.BLOCK,
              value: 3,
            },
            selectiveTestflowRun:{
              area: LimitArea.TESTFLOW,
              active: false
            }
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: "system",
          updatedBy: "system",
        };

        await planCollection.insertOne(plan);
        console.log("\x1b[36mCommunity Plan created successfully.\x1b[0m");
      } else {
        console.log("\x1b[33mCommunity Plan already exists. Skipping.\x1b[0m");
      }
    } catch (error) {
      console.error("Error during migration:", error);
    }
  }
}
