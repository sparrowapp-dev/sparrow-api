import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { Db } from "mongodb";
import { ObjectId, WithId } from "mongodb";
import { User, UserWorkspaceDto } from "@src/modules/common/models/user.model";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { DownGradeUserTourGuideDto } from "../payloads/downgrade-user.payload";
import { TeamDto } from "@src/modules/common/models/team.model";

/**
 * Repository for handling promo code database operations
 */
@Injectable()
export class DownGradeUserRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}
  async findUserByUserId(id: ObjectId): Promise<WithId<User>> {
    const userData = await this.db
      .collection<User>(Collections.USER)
      .findOne({ _id: id });
    return userData;
  }

  async updateUserById(
    id: ObjectId,
    updateParams: Partial<DownGradeUserTourGuideDto>,
  ): Promise<WithId<User>> {
    const updatedUserParams = {
      $set: updateParams,
    };
    const responseData = await this.db
      .collection<User>(Collections.USER)
      .findOneAndUpdate({ _id: id }, updatedUserParams);
    return responseData.value;
  }

  async updateUserTeamsAndWorkspaces(
    userId: ObjectId,
    updatedTeams: TeamDto[],
    updatedWorkspaces: UserWorkspaceDto[],
  ): Promise<WithId<User>> {
    if (!userId) {
      throw new BadRequestException("User ID is required.");
    }
    if (!Array.isArray(updatedTeams)) {
      throw new BadRequestException("updatedTeams must be an array.");
    }
    if (!Array.isArray(updatedWorkspaces)) {
      throw new BadRequestException("updatedWorkspaces must be an array.");
    }
    const updatePayload: Partial<User> = {
      teams: updatedTeams,
      workspaces: updatedWorkspaces,
      updatedAt: new Date(),
    };
    try {
      const result = await this.db
        .collection<User>(Collections.USER)
        .findOneAndUpdate(
          { _id: userId },
          { $set: updatePayload },
          { returnDocument: "after" },
        );
      if (!result.value) {
        throw new BadRequestException("User not found.");
      }
      return result.value;
    } catch (error) {
      console.error("Error updating user teams and workspaces:", error);
    }
  }

  async findUsersByIdArray(IdArray: Array<ObjectId>): Promise<WithId<User>[]> {
    const response = await this.db
      .collection<User>(Collections.USER)
      .find({ _id: { $in: IdArray } })
      .toArray();
    return response;
  }

  async findUsersByStringIds(ids: string[]): Promise<WithId<User>[]> {
    try {
      const objectIds = ids.map((id) => new ObjectId(id));
      const users = await this.db
        .collection<User>(Collections.USER)
        .find({ _id: { $in: objectIds } })
        .toArray();
      if (!users || users.length === 0) {
        return;
      }
      return users;
    } catch (error) {
      console.error("Error fetching users by string IDs:", error);
    }
  }
}
