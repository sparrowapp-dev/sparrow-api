import { Injectable, Inject } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";

@Injectable()
export class AdminMembersRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Count workspaces a user has access to within a specific hub
   */
  async countUserWorkspacesByHubId(
    memberId: string,
    hubId: string,
  ): Promise<number> {
    try {
      const memberIdObj =
        typeof memberId === "string" ? new ObjectId(memberId) : memberId;

      // Find the user in the users collection
      const user = await this.db
        .collection("user")
        .findOne({ _id: memberIdObj }, { projection: { workspaces: 1 } });

      if (!user || !user.workspaces) {
        return 0;
      }

      // Count workspaces that belong to the specified hub
      const hubWorkspaces = user.workspaces.filter(
        (workspace: any) =>
          workspace.teamId && workspace.teamId.toString() === hubId,
      );

      return hubWorkspaces.length;
    } catch (error) {
      console.error(
        `Error getting workspace access for user ${memberId}:`,
        error,
      );
      return 0;
    }
  }
}
