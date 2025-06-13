import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db, ObjectId } from "mongodb";

const planId = "68"; 
const planName = "Standard"; 
const teamId = "6y";


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
      const workspaceCollection = this.db.collection(Collections.WORKSPACE);


      const teamResponse  = await teamsCollection.updateOne(
        { _id: new ObjectId(teamId) }, // Replace with the actual team ID
        { $set: {
          'plan.id': new ObjectId(planId),
          'plan.name': planName,
        }, },
      );

      const workspaceResponse = await workspaceCollection.updateMany(
        { 'team.id': teamId },
        {
          $set: {
            'plan.id': new ObjectId(planId),
            'plan.name': planName,
          },
        }
      );
      console.log(
        `\x1b[32m[Nest] \x1b[33m${(teamResponse?.matchedCount + workspaceResponse?.matchedCount) || 0}\x1b[0m \x1b[32maffected documents, migration completed successfully.`,
      );
      this.hasRun = true; // Set flag after successful execution
    } catch (error) {
      console.error("Error during migration:", error);
    }
  }
}
