import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { LimitArea } from "@src/modules/common/models/plan.model";

@Injectable()
export class AddCommunityPlanToTeamsMigration implements OnModuleInit {
  private hasRun = false;

  constructor(@Inject("DATABASE_CONNECTION") private readonly db: Db) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;

    try {
      console.log("Running AddCommunityPlanToTeamsMigration...");

      const teamCollection = this.db.collection(Collections.TEAM);

      const planId = new ObjectId("68f226aee37f6bdd541bfaa2");
      const createdAt = new Date("2025-10-17T11:21:18.843Z");

      // Update teams that don't have a plan or where plan.id is missing
      const query = {
        $or: [
          { plan: { $exists: false } },
          { plan: null },
          { "plan.id": { $exists: false } },
        ],
      };

      const update = {
        $set: {
          plan: {
            id: planId,
            name: "Community",
            description: "Free tier with limited access",
            active: true,
            limits: {
              workspacesPerHub: {
                area: LimitArea.HUB,
                value: 3,
              },
              testflowPerWorkspace: {
                area: LimitArea.WORKSPACE,
                value: 3,
              },
              blocksPerTestflow: {
                area: LimitArea.TESTFLOW,
                value: 5,
              },
              usersPerHub: {
                area: LimitArea.HUB,
                value: 5,
              },
              selectiveTestflowRun: {
                area: LimitArea.TESTFLOW,
                active: false,
              },
              activeSync: {
                area: LimitArea.COLLECTION,
                active: false,
              },
              testflowRunHistory: {
                area: LimitArea.TESTFLOW,
                value: 5,
              },
              aiRequestsPerMonth: {
                area: LimitArea.AI,
                value: 50,
              },
              testflowScheduleRun: {
                area: LimitArea.TESTFLOW_SCHEDULE_RUN,
                value: 3,
              },
            },
            createdAt,
            updatedAt: createdAt,
            createdBy: "system",
            updatedBy: "system",
          },
        },
      };

      const result = await teamCollection.updateMany(query, update);
      console.log(`Updated ${result.modifiedCount} team(s) with the Community plan.`);

      this.hasRun = true;
    } catch (error) {
      console.error("Error during AddCommunityPlanToTeamsMigration:", error);
    }
  }
}
