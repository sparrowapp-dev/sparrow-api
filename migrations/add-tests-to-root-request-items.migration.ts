
import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db } from "mongodb";
import { ItemTypeEnum } from "@src/modules/common/models/collection.model";


@Injectable()
export class AddTestsToRootRequestItemsMigration implements OnModuleInit {
  private hasRun = false;
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;
    try {
      console.log("[Nest] Starting AddTestsToRootRequestItemsMigration...");
      const collectionCollection = this.db.collection(Collections.COLLECTION);
      const collections = await collectionCollection.find().toArray();
      let updatedCount = 0;
      for (const collection of collections) {
        let updated = false;


        function addFieldsToRequestItems(items: any[]): void {
          if (!Array.isArray(items)) return;
          for (const item of items) {
            if (item.type === ItemTypeEnum.REQUEST && item.request) {
              // Add tests if missing
              if (!item?.request?.tests) {
                item.request.tests = {
                  testCaseMode: "no-code",
                  noCode: [
                    {
                      id: "case-1",
                      name: "New Test",
                      condition: "",
                      expectedResult: "",
                      testPath: "",
                      testTarget: "",
                    },
                  ],
                  script: "",
                };
                updated = true;
              }
              // Add selectedRequestAuthProfileId if missing
              if (!item?.request?.selectedRequestAuthProfileId) {
                item.request.selectedRequestAuthProfileId = "";
                updated = true;
              }
            }
            if (Array.isArray(item.items)) {
              addFieldsToRequestItems(item.items);
            }
          }
        }

        addFieldsToRequestItems(collection.items);

        if (updated) {
          await collectionCollection.updateOne(
            { _id: collection._id },
            { $set: { items: collection.items } }
          );
          updatedCount++;
        }
      }
      console.log(`[Nest] Migration completed: ${updatedCount} collections updated with tests object.`);
      this.hasRun = true;
    } catch (error) {
      console.error("[Nest] Error during AddTestsToRootRequestItemsMigration:", error);
    }
  }
}
