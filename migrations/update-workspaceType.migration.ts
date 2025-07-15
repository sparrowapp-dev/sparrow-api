import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Workspace, WorkspaceType } from "@src/modules/common/models/workspace.model";
import { Db } from "mongodb";

@Injectable()
export class UpdateWorkspaceTypeMigration implements OnModuleInit {
  private hasRun = false;
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) {
        // Check if migration has already run
        return;
      }
    try {
      console.log(
        `\n\x1b[32m[Nest]\x1b[0m \x1b[32mExecuting Workspace Type Migration...`,
      );

      // Update workspaceType field in Workspace collection
      const result = await this.db
        .collection<Workspace>(Collections.WORKSPACE)
        .updateMany(
          { workspaceType: { $exists: false } },
          { $set: { workspaceType: WorkspaceType.PRIVATE } }, // Use enum value
        );

      console.log(
        `\x1b[32m[Nest]\x1b[0m \x1b[32m${result.modifiedCount} workspaces updated successfully.`,
      );
      this.hasRun = true; // Set flag after successful execution
    } catch (error) {
      console.error("Error during workspace type migration:", error);
    }
  }
}
