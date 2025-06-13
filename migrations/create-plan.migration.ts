import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { LimitArea } from "@src/modules/common/models/plan.model";

import { Db } from "mongodb";

@Injectable()
export class CreatePlanMigration implements OnModuleInit {
  private hasRun = false;
  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db, // Inject the MongoDB connection
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      if (this.hasRun) {
        // Check if migration has already run
        return;
      }
      const defaultHubPlan =
        this.configService.get<string>("app.defaultHubPlan");
      const planCollection = this.db.collection(Collections.PLAN);

      ////////////////////////////////////////////////////////////////
      ////////////////////////////////////////////////////////////////
      ////////////////////////////////////////////////////////////////
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
            usersPerHub: {
              area: LimitArea.BLOCK,
              value: 3,
            },
            selectiveTestflowRun: {
              area: LimitArea.TESTFLOW,
              active: false
            },
            activeSync:{
              area: LimitArea.COLLECTION,
              active: false
            },
            testflowRunHistory: {
              area: LimitArea.TESTFLOW_RUNHISTORY,
              value: 5,
            },
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
      ////////////////////////////////////////////////////////////////
      ////////////////////////////////////////////////////////////////
      ////////////////////////////////////////////////////////////////

      const existingStandardPlan = await planCollection.findOne({
        name: "Standard",
      });

      if (!existingStandardPlan) {
        const plan = {
          name: "Standard",
          description: "Standard tier with limited access",
          active: true,
          limits: {
            workspacesPerHub: {
              area: LimitArea.WORKSPACE,
              value: 5,
            },
            testflowPerWorkspace: {
              area: LimitArea.TESTFLOW,
              value: 10,
            },
            blocksPerTestflow: {
              area: LimitArea.BLOCK,
              value: 30,
            },
            usersPerHub: {
              area: LimitArea.BLOCK,
              value: 100000,
            },
            selectiveTestflowRun: {
              area: LimitArea.TESTFLOW,
              active: true
            },
            activeSync:{
              area: LimitArea.COLLECTION,
              active: false
            },
            testflowRunHistory: {
              area: LimitArea.TESTFLOW_RUNHISTORY,
              value: 10,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: "system",
          updatedBy: "system",
        };

        await planCollection.insertOne(plan);
        console.log("\x1b[36mStandard Plan created successfully.\x1b[0m");
      } else {
        console.log("\x1b[33mStandard Plan already exists. Skipping.\x1b[0m");
      }
      ////////////////////////////////////////////////////////////////
      ////////////////////////////////////////////////////////////////
      ////////////////////////////////////////////////////////////////

      const existingProfessionalPlan = await planCollection.findOne({
        name: "Professional",
      });

      if (!existingProfessionalPlan) {
        const plan = {
          name: "Professional",
          description: "Standard tier with limited access",
          active: true,
          limits: {
            workspacesPerHub: {
              area: LimitArea.WORKSPACE,
              value: 10,
            },
            testflowPerWorkspace: {
              area: LimitArea.TESTFLOW,
              value: 25,
            },
            blocksPerTestflow: {
              area: LimitArea.BLOCK,
              value: 30,
            },
            usersPerHub: {
              area: LimitArea.BLOCK,
              value: 100000,
            },
            selectiveTestflowRun: {
              area: LimitArea.TESTFLOW,
              active: true
            },
            activeSync:{
              area: LimitArea.COLLECTION,
              active: true
            },
            testflowRunHistory: {
              area: LimitArea.TESTFLOW_RUNHISTORY,
              value: 25,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: "system",
          updatedBy: "system",
        };

        await planCollection.insertOne(plan);
        console.log("\x1b[36mProfessional Plan created successfully.\x1b[0m");
      } else {
        console.log(
          "\x1b[33mProfessional Plan already exists. Skipping.\x1b[0m",
        );
      }
      this.hasRun = true; // Set flag after successful execution
    } catch (error) {
      console.error("Error during migration:", error);
    }
  }
}
