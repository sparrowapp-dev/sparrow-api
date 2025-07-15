import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db } from "mongodb";

@Injectable()
export class UpgradePlanMigration implements OnModuleInit {
    private hasRun = false;
  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db, // Inject the MongoDB connection
  ) {}

  async onModuleInit(): Promise<void> {
    try {
        if (this.hasRun) {
            // Check if migration has already run
            return;
          }
      console.log(
        `\n\x1b[32m[Nest]\x1b[0m \x1b[32mExecuting Upgrade plan Data Migration...`,
      );
      const teamsCollection = this.db.collection(Collections.TEAM);
      const planCollection = this.db.collection(Collections.PLAN);
      const workspaceCollection = this.db.collection(Collections.WORKSPACE);

      let teamResponseCount = 0;
      const plans = await planCollection.find().toArray();
      for(let i = 0; i < plans.length; i++){
        let plan = plans[i];
        plan.id = plan._id;
        delete plan._id;
        console.log(plan.name);
        const teamResponse = await teamsCollection.updateMany(
          { 'plan.name': plan.name }, 
          {
            $set: {
              'plan': plan,
            },
          }
        );
        teamResponseCount += teamResponse?.matchedCount;
      }


      const workspaceResponse = await workspaceCollection.updateMany(
        {},
        {
          $unset: {
            plan: "",
          },
        }
      );
      console.log(
        `\x1b[32m[Nest] \x1b[33m${(teamResponseCount + workspaceResponse?.matchedCount) || 0}\x1b[0m \x1b[32maffected documents, migration completed successfully.`,
      );
      this.hasRun = true; // Set flag after successful execution
    } catch (error) {
      console.error("Error during migration:", error);
    }
  }
}
