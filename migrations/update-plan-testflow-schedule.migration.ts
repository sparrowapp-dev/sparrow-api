import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { LimitArea, Plan } from "@src/modules/common/models/plan.model";
import { Team } from "@src/modules/common/models/team.model";
import { Db } from "mongodb";

@Injectable()
export class UpdatePlanTestflowScheduleMigration implements OnModuleInit {
  private hasRun = false;
  constructor(@Inject("DATABASE_CONNECTION") private readonly db: Db) {}
  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;
    try {
      console.log(
        "\x1b[36m[Nest]\x1b[0m \x1b[36mStarting UpdatePlanTestflowScheduleMigration...\x1b[0m",
      );

      const planCollection = this.db.collection<Plan>(Collections.PLAN);
      const teamCollection = this.db.collection<Team>(Collections.TEAM);

      const plans = await planCollection.find().toArray();
      const teams = await teamCollection.find().toArray();

      let updatedPlanCount = 0;
      let updatedTeamCount = 0;

      // --- Update PLANS ---
      for (const plan of plans) {
        const limits = plan.limits;
        let desiredValue = 3;

        switch (plan.name) {
          case "Standard":
            desiredValue = 10;
            break;
          case "Professional":
            desiredValue = 25;
            break;
          case "Community":
          default:
            desiredValue = 3;
            break;
        }

        const existingValue = limits.testflowScheduleRun?.value;
        const fieldExists = limits.testflowScheduleRun !== undefined;

        if (!fieldExists || existingValue !== desiredValue) {
          await planCollection.updateOne(
            { _id: plan._id },
            {
              $set: {
                "limits.testflowScheduleRun": {
                  area: LimitArea.TESTFLOW_SCHEDULE_RUN,
                  value: desiredValue,
                },
                updatedAt: new Date(),
                updatedBy: "system",
              },
            },
          );
          updatedPlanCount++;
        }
      }

      // --- Update TEAM PLANS ---
      for (const team of teams) {
        const teamPlan = team.plan;
        if (!teamPlan) continue;

        let desiredValue = 3;
        switch (teamPlan.name) {
          case "Standard":
            desiredValue = 10;
            break;
          case "Professional":
            desiredValue = 25;
            break;
          case "Community":
          default:
            desiredValue = 3;
            break;
        }

        const existingValue = teamPlan.limits?.testflowScheduleRun?.value;
        const fieldExists = teamPlan.limits?.testflowScheduleRun !== undefined;

        if (!fieldExists || existingValue !== desiredValue) {
          await teamCollection.updateOne(
            { _id: team._id },
            {
              $set: {
                "plan.limits.testflowScheduleRun": {
                  area: LimitArea.TESTFLOW_SCHEDULE_RUN,
                  value: desiredValue,
                },
                updatedAt: new Date(),
                updatedBy: "system",
              },
            },
          );
          updatedTeamCount++;
        }
      }

      console.log(
        `\x1b[32m[Nest]\x1b[0m \x1b[33m${updatedPlanCount}\x1b[0m plans updated and \x1b[33m${updatedTeamCount}\x1b[0m teams updated with correct 'testflowScheduleRun' values.\x1b[0m`,
      );

      this.hasRun = true;
    } catch (error) {
      console.error(
        "\x1b[31m[Nest] Error during UpdatePlanTestflowScheduleMigration:\x1b[0m",
        error,
      );
    }
  }
}
