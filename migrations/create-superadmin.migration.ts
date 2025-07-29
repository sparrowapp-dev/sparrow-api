import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db } from "mongodb";

@Injectable()
export class CreateSuperadminMigration implements OnModuleInit {
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

      const superadminsCollection = this.db.collection(Collections.SUPERADMINS);

      // Check if super admin already exists
      const existingSuperAdmin = await superadminsCollection.findOne({
        emails: { $in: ["example@example.com"] },
      });

      if (!existingSuperAdmin) {
        const superAdmin = {
          emails: ["example@example.com"],
        };

        await superadminsCollection.insertOne(superAdmin);
        console.log("\x1b[36mSuper admin created successfully.\x1b[0m");
      } else {
        console.log("\x1b[33mSuper admin already exists. Skipping.\x1b[0m");
      }

      this.hasRun = true; // Set flag after successful execution
    } catch (error) {
      console.error("Error during super admin migration:", error);
    }
  }
}
