// import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
// import { Db, ObjectId } from "mongodb";
// import { v4 as uuidv4 } from "uuid";
// import { Collections } from "@src/modules/common/enum/database.collection.enum";

// @Injectable()
// export class AuthToAuthProfilesMigration implements OnModuleInit {
//   private hasRun = false;

//   constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

//   async onModuleInit(): Promise<void> {
//     if (this.hasRun) return;

//     try {
//       console.log(`\n\x1b[32m[Nest]\x1b[0m \x1b[32mRunning AuthToAuthProfilesMigration...`);

//       const collection = this.db.collection(Collections.COLLECTION);

//       const documents = await collection
//         .find({
//           $or: [
//             { auth: { $type: "object" }, "auth.0": { $exists: false } }, // Valid auth object (not array)
//             { auth: { $exists: false } }, // No auth field
//             { auth: null }, // Null auth
//           ],
//         })
//         .toArray();

//       if (documents.length === 0) {
//         console.log("No documents needing authProfiles migration.");
//         this.hasRun = true;
//         return;
//       }

//       const now = new Date();

//       for (const doc of documents) {
//         const authObject = doc.auth;

//         // Case 1: auth is missing or invalid
//         if (!authObject || typeof authObject !== "object" || Array.isArray(authObject)) {
//           const update: any = {};

//           if (!Array.isArray(doc.authProfiles)) {
//             update.$set = { authProfiles: [] };

//             await collection.updateOne(
//               { _id: new ObjectId(doc._id) },
//               update
//             );

//             console.log(`Set empty authProfiles for document: ${doc._id}`);
//           } else {
//             console.log(`authProfiles already exists for document: ${doc._id}`);
//           }

//           continue;
//         }

//         // Case 2: auth is a valid object, migrate to authProfiles
//         let authType = "";
//         const { bearerToken, basicAuth = {}, apiKey = {} } = authObject;

//         const hasBearer = bearerToken && bearerToken.trim() !== "";
//         const hasBasic = basicAuth.username?.trim() || basicAuth.password?.trim();
//         const hasApiKey = apiKey.authKey?.trim() || apiKey.authValue?.trim();

//         if (hasBearer) {
//           authType = "Bearer Token";
//         } else if (hasBasic) {
//           authType = "Basic Auth";
//         } else if (hasApiKey) {
//           authType = "API Key";
//         } else {
//           console.warn(`Skipping ${doc._id}: no valid auth data.`);
//           continue;
//         }

//         const newAuthProfile = {
//           name: "New-Auth-Profile",
//           description: "",
//           authType,
//           auth: {
//             bearerToken: bearerToken || "",
//             basicAuth: {
//               username: basicAuth.username || "",
//               password: basicAuth.password || "",
//             },
//             apiKey: {
//               authKey: apiKey.authKey || "",
//               authValue: apiKey.authValue || "",
//               addTo: apiKey.addTo || "Header",
//             },
//           },
//           defaultKey: false,
//           createdAt: now,
//           authId: uuidv4(),
//         };

//         const update: any = {};

//         if (Array.isArray(doc.authProfiles)) {
//           update.$push = { authProfiles: newAuthProfile };
//         } else {
//           update.$set = { authProfiles: [newAuthProfile] };
//         }

//         await collection.updateOne(
//           { _id: new ObjectId(doc._id) },
//           update
//         );

//         console.log(`Updated authProfiles for document: ${doc._id}`);
//       }

//       console.log(`Migration completed. Total processed: ${documents.length}`);
//       this.hasRun = true;
//     } catch (error) {
//       console.error("Error during AuthToAuthProfilesMigration:", error);
//     }
//   }
// }


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
