import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { LimitArea } from "@src/modules/common/models/plan.model";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AddCommunityPlanToTeamsMigration implements OnModuleInit {
  private hasRun = false;

  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;

    try {
      console.log("Running AddCommunityPlanToTeamsMigration...");

      const teamCollection = this.db.collection(Collections.TEAM);
      const planCollection = this.db.collection(Collections.PLAN);

      // Get the default hub plan name from config
      const defaultHubPlan =
        this.configService.get<string>("app.defaultHubPlan");
      // Fetch the plan from plan collection
      const planDoc = await planCollection.findOne({ name: defaultHubPlan });
      if (!planDoc) {
        console.warn(
          `Plan '${defaultHubPlan}' not found in plan collection. Skipping team updates.`,
        );
        return;
      }
      const { _id, ...planData } = planDoc;

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
            id: _id,
            ...planData,
          },
        },
      };

      const result = await teamCollection.updateMany(query, update);
      console.log(
        `Updated ${result.modifiedCount} team(s) with the Community plan.`,
      );

      this.hasRun = true;
    } catch (error) {
      console.error("Error during AddCommunityPlanToTeamsMigration:", error);
    }
  }
}
