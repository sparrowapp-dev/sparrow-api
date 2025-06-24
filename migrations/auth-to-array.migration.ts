import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";

@Injectable()
export class AuthToArrayMigration implements OnModuleInit {
  private hasRun = false;

  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;

    try {
      console.log(
        `\n\x1b[32m[Nest]\x1b[0m \x1b[32mRunning AuthToArrayMigration...`,
      );

      const collection = this.db.collection(Collections.COLLECTION);

      const documents = await collection
        .find({
          auth: { $type: "object" }, // Must be plain object
          "auth.0": { $exists: false }, // Ensure it's not already an array
        })
        .toArray();

      if (documents.length === 0) {
        console.log("No documents needing auth migration.");
        this.hasRun = true;
        return;
      }

      for (const doc of documents) {
        const authObject = doc.auth;

        if (authObject && typeof authObject === "object" && !Array.isArray(authObject)) {
          await collection.updateOne(
            { _id: new ObjectId(doc._id) },
            { $set: { auth: [authObject] } },
          );
          console.log(`Migrated document: ${doc._id}`);
        }
      }

      console.log(`Auth field migration completed. Total updated: ${documents.length}`);
      this.hasRun = true;
    } catch (error) {
      console.error("Error during AuthToArrayMigration:", error);
    }
  }
}
