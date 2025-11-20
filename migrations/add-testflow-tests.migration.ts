import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import {
  RequestTestCases,
  TestCaseModeEnum,
  Testflow,
} from "@src/modules/common/models/testflow.model";
import { Db } from "mongodb";

@Injectable()
export class addTestflowTestsMigration implements OnModuleInit {
  private hasRun = false;

  constructor(@Inject("DATABASE_CONNECTION") private readonly db: Db) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;
    this.hasRun = true;

    try {
      console.log(
        "\x1b[36m[Nest] Starting addTestflowTestsMigration...\x1b[0m",
      );

      const testflowCollection = this.db.collection<Testflow>(
        Collections.TESTFLOW,
      );
      const testflows = await testflowCollection.find().toArray();

      const defaultTests: RequestTestCases = {
        testCaseMode: TestCaseModeEnum.NO_CODE,
        noCode: [],
        script: "",
        preScript: "",
      };

      for (const testflow of testflows) {
        let isUpdated = false;

        testflow.nodes?.forEach((node) => {
          if (node?.data?.requestData) {
            // Only fill default when `tests` does NOT exist
            if (!node.data.requestData.tests) {
              node.data.requestData.tests = defaultTests;
              isUpdated = true;
            }
          }
        });

        // Save only if modified
        if (isUpdated) {
          await testflowCollection.updateOne(
            { _id: testflow._id },
            { $set: { nodes: testflow.nodes } },
          );
        }
      }

      console.log("\x1b[32m[Nest] addTestflowTestsMigration completed.\x1b[0m");
    } catch (error) {
      console.error(
        "\x1b[31m[Nest] Error during addTestflowTestsMigration:\x1b[0m",
        error,
      );
    }
  }
}
