import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Db } from "mongodb";
import { createHmac } from "crypto";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { User } from "@src/modules/common/models/user.model";

@Injectable()
export class LoadTestUsersMigration implements OnModuleInit {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async onModuleInit(): Promise<void> {
    const baseEmail = "techdome.load.testing";
    const domain = "@yopmail.com";
    const password = "Techdome@123";

    for (let i = 5; i <= 10; i++) {
      const email = `${baseEmail}${i}${domain}`;
      const existing = await this.db
        .collection<User>(Collections.USER)
        .findOne({ email });

      if (existing) {
        console.log(`🔁 User already exists: ${email}`);
        continue;
      }

      const userPayload = {
        email,
        name: `Test User ${i}`,
        password: createHmac("sha256", password).digest("hex"),
        isEmailVerified: true,
        isUserAcceptedOccasionalUpdates: true,
        teams: [] as any[],
        workspaces: [] as any[],
      };

      await this.db.collection<User>(Collections.USER).insertOne(userPayload);
      console.log(`✅ Created test user: ${email}`);
    }
  }
}
