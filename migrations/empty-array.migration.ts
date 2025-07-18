import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";

@Injectable()
export class AuthToAuthProfilesMigration implements OnModuleInit {
  private hasRun = false;

  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;

    try {
      console.log(`\n\x1b[32m[Nest]\x1b[0m \x1b[32mRunning AddEmptyAuthProfilesMigration...`);

      const collection = this.db.collection(Collections.COLLECTION);

      const documents = await collection
        .find({
          $or: [
            { authProfiles: { $exists: false } },
            { authProfiles: { $not: { $type: "array" } } },
          ],
        })
        .toArray();

      if (documents.length === 0) {
        console.log("No documents needing authProfiles initialization.");
        this.hasRun = true;
        return;
      }

      for (const doc of documents) {
        await collection.updateOne(
          { _id: new ObjectId(doc._id) },
          { $set: { authProfiles: [] } }
        );
        console.log(`Set empty authProfiles for document: ${doc._id}`);
      }

      console.log(`Migration completed. Total updated: ${documents.length}`);
      this.hasRun = true;
    } catch (error) {
      console.error("Error during AddEmptyAuthProfilesMigration:", error);
    }
  }
}
