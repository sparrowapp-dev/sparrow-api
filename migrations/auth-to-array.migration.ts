import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { Collections } from "@src/modules/common/enum/database.collection.enum";

@Injectable()
export class AuthToArrayMigration implements OnModuleInit {
  private hasRun = false;

  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;

    try {
      console.log(`\n\x1b[32m[Nest]\x1b[0m \x1b[32mRunning AuthToArrayMigration...`);

      const collection = this.db.collection(Collections.COLLECTION);

      const documents = await collection
        .find({
          auth: { $type: "object" },
          "auth.0": { $exists: false },
        })
        .toArray();

      if (documents.length === 0) {
        console.log("No documents needing auth migration.");
        this.hasRun = true;
        return;
      }

      const now = new Date();

      for (const doc of documents) {
        const authObject = doc.auth;

        if (
          authObject &&
          typeof authObject === "object" &&
          !Array.isArray(authObject)
        ) {
          // Determine which auth type has actual data
          let authType = "";
          const { bearerToken, basicAuth = {}, apiKey = {} } = authObject;

          const hasBearer = bearerToken && bearerToken.trim() !== "";
          const hasBasic = basicAuth.username?.trim() || basicAuth.password?.trim();
          const hasApiKey = apiKey.authKey?.trim() || apiKey.authValue?.trim();

          if (hasBearer) {
            authType = "Bearer Token";
          } else if (hasBasic) {
            authType = "Basic Auth";
          } else if (hasApiKey) {
            authType = "API Key";
          } else {
            console.warn(`Skipping ${doc._id}: no valid auth data.`);
            continue;
          }

          // Preserve full structure (including empty values)
          const newAuthArray = [
            {
              name: "New-Auth-Profile",
              description: "",
              authType,
              auth: {
                bearerToken: bearerToken || "",
                basicAuth: {
                  username: basicAuth.username || "",
                  password: basicAuth.password || "",
                },
                apiKey: {
                  authKey: apiKey.authKey || "",
                  authValue: apiKey.authValue || "",
                  addTo: apiKey.addTo || "Header",
                },
              },
              defaultKey: true,
              createdAt: now,
              authId: uuidv4(),
            },
          ];

          await collection.updateOne(
            { _id: new ObjectId(doc._id) },
            { $set: { auth: newAuthArray } },
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
