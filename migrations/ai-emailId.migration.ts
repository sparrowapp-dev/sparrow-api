import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";

@Injectable()
export class AIlogsEmailIdMigration implements OnModuleInit {
  private hasRun = false;

  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;

    try {
      console.log(`\n[Nest] Executing AIlogs emailId migration...`);

      const aiLogsCollection = this.db.collection(Collections.AILOGS);
      const userCollection = this.db.collection(Collections.USER);

      // Get docs where emailId is missing, null, or empty string
      const cursor = aiLogsCollection.find({
        $or: [
          { emailId: { $exists: false } },
          { emailId: null },
          { emailId: "" }
        ]
      });

      let updatedCount = 0;

      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (!doc?.userId || doc.userId === "null") continue;

        try {
          // Convert userId to ObjectId if valid
          const userId =
            typeof doc.userId === "string" && ObjectId.isValid(doc.userId)
              ? new ObjectId(doc.userId)
              : doc.userId;

          // Fetch user email
          const user = await userCollection.findOne(
            { _id: userId },
            { projection: { email: 1 } }
          );

          if (!user?.email) continue;

          // Update AIlogs document
          await aiLogsCollection.updateOne(
            { _id: doc._id },
            { $set: { emailId: user.email } }
          );

          updatedCount++;
        } catch (err) {
          console.error(`Failed to update doc ${doc._id}:`, err.message);
        }
      }

      console.log(`Updated ${updatedCount} AIlogs documents with emailId`);
      this.hasRun = true;
      console.log("Migration completed successfully. Exiting...");

      process.exit(0);
    } catch (error) {
      console.error("Error during AIlogs emailId migration:", error);
      process.exit(1);
    }
  }
}
