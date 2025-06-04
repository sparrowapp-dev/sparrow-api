import { Injectable, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
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
        .collection(Collections.USER)
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

  /**
   * Find users by ID array
   */
  async findUsersByIds(userIds: ObjectId[]): Promise<any[]> {
    try {
      return await this.db
        .collection(Collections.USER)
        .find({ _id: { $in: userIds } })
        .project({ _id: 1, name: 1, email: 1 })
        .toArray();
    } catch (error) {
      console.error("Error finding users by IDs:", error);
      throw error;
    }
  }
}
