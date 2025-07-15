import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { LimitArea } from "@src/modules/common/models/plan.model";
import { Db } from "mongodb";

@Injectable()
export class UpdateTestflowHistoryPlanMigration implements OnModuleInit {
  private hasRun = false;

  constructor(@Inject("DATABASE_CONNECTION") private readonly db: Db) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;

    try {
      console.log(
        "\x1b[36m[Nest]\x1b[0m \x1b[36mStarting UpdateTestflowRunHistoryLimitMigration...\x1b[0m",
      );

      const planCollection = this.db.collection(Collections.PLAN);
      const plans = await planCollection.find().toArray();

      let updatedCount = 0;

      for (const plan of plans) {
        const limits = plan.limits || {};
        let desiredValue = 5;

        switch (plan.name) {
          case "Standard":
          case "Professional":
            desiredValue = 100000;
            break;
          case "Community":
          default:
            desiredValue = 5;
            break;
        }

        const existingValue = limits.testflowRunHistory?.value;
        const fieldExists = limits.testflowRunHistory !== undefined;

        if (!fieldExists || existingValue !== desiredValue) {
          await planCollection.updateOne(
            { _id: plan._id },
            {
              $set: {
                "limits.testflowRunHistory": {
                  area: LimitArea.TESTFLOW_RUNHISTORY,
                  value: desiredValue,
                },
                updatedAt: new Date(),
                updatedBy: "system",
              },
            },
          );

          const action = fieldExists ? "updated" : "added";
          console.log(
            `\x1b[32m[Nest]\x1b[0m ${plan.name} plan ${action} with testflowRunHistory value: ${desiredValue}`,
          );
          updatedCount++;
        }
      }

      console.log(
        `\x1b[32m[Nest]\x1b[0m \x1b[33m${updatedCount}\x1b[0m \x1b[32mplans updated with correct 'testflowRunHistory' values.\x1b[0m`,
      );

      this.hasRun = true;
    } catch (error) {
      console.error(
        "\x1b[31m[Nest] Error during UpdateTestflowRunHistoryLimitMigration:\x1b[0m",
        error,
      );
    }
  }
}
