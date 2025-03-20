import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db, ObjectId } from "mongodb";

@Injectable()
export class AddWorkspaceIdMigration implements OnModuleInit {
  private hasRun = false;
  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db, // Inject the MongoDB connection
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) {
      // Check if migration has already run
      return;
    }
    try {
      const workspaceCollection = this.db.collection(Collections.WORKSPACE);
      const environmentCollection = this.db.collection(Collections.ENVIRONMENT);
      const collectionCollection = this.db.collection(Collections.COLLECTION);
      const testflowCollection = this.db.collection(Collections.TESTFLOW);

      const workspaces = await workspaceCollection.find().toArray();
      let totalModified = 0; // Counter for modified documents

      for (let i = 0; i < workspaces.length; i++) {
        for (let j = 0; j < workspaces[i].environments?.length; j++) {
          const environmentId = new ObjectId(
            workspaces[i].environments[j].id.toString(),
          );
          const result = await environmentCollection.updateOne(
            { _id: environmentId, workspaceId: { $exists: false } },
            { $set: { workspaceId: workspaces[i]._id.toString() } },
          );
          totalModified += result.modifiedCount;
        }
        for (let j = 0; j < workspaces[i].collection?.length; j++) {
          const collectionId = new ObjectId(
            workspaces[i].collection[j].id.toString(),
          );
          const result = await collectionCollection.updateOne(
            { _id: collectionId, workspaceId: { $exists: false } },
            { $set: { workspaceId: workspaces[i]._id.toString() } },
          );
          totalModified += result.modifiedCount;
        }
        for (let j = 0; j < workspaces[i].testflows?.length; j++) {
          const testflowId = new ObjectId(
            workspaces[i].testflows[j].id.toString(),
          );
          const result = await testflowCollection.updateOne(
            { _id: testflowId, workspaceId: { $exists: false } },
            { $set: { workspaceId: workspaces[i]._id.toString() } },
          );
          totalModified += result.modifiedCount;
        }
      }

      console.log(
        `\x1b[32m[Nest] \x1b[33m${totalModified}\x1b[0m \x1b[32maffected documents, migration completed successfully.`,
      );
      this.hasRun = true; // Set flag after successful execution
      return;
    } catch (error) {
      console.error("Error during migration:", error);
    }
  }
}
