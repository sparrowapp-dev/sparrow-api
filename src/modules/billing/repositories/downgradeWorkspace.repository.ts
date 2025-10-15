import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { UserDto, Workspace } from "@src/modules/common/models/workspace.model";
import { Db, DeleteResult } from "mongodb";
import { ObjectId, WithId } from "mongodb";

/**
 * Repository for handling promo code database operations
 */
@Injectable()
export class DownGradeWorkspaceRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async get(id: string): Promise<WithId<Workspace>> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .findOne({ _id });
    if (!data) {
      throw new BadRequestException("Not Found");
    }
    return data;
  }

  async getWorkspacesByIds(ids: string[]): Promise<WithId<Workspace>[]> {
    if (!ids || ids.length === 0) {
      throw new BadRequestException("workspaceIds are required.");
    }
    const objectIds = ids.map((id) => new ObjectId(id));
    try {
      const data = await this.db
        .collection<Workspace>(Collections.WORKSPACE)
        .find({ _id: { $in: objectIds } })
        .toArray();
      if (!data || data.length === 0) {
        throw new BadRequestException("No workspaces found.");
      }
      return data;
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      throw new BadRequestException("Failed to fetch workspaces.");
    }
  }

  delete(id: string): Promise<DeleteResult> {
    const _id = new ObjectId(id);
    return this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .deleteOne({ _id });
  }

  async setWorkspaceRestriction(
    workspaceId: string,
    isRestricted: boolean,
  ): Promise<WithId<Workspace>> {
    const _id = new ObjectId(workspaceId);
    const result = await this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .findOneAndUpdate(
        { _id },
        { $set: { isRestricted, updatedAt: new Date() } },
        { returnDocument: "after" },
      );
    if (!result.value) {
      throw new BadRequestException("Workspace not found or update failed");
    }
    return result.value;
  }

  async updateWorkspaceUsers(
    workspaceId: string,
    updatedUsers: UserDto[],
  ): Promise<any> {
    if (!workspaceId) {
      throw new BadRequestException("workspaceId is required.");
    }
    if (!Array.isArray(updatedUsers)) {
      throw new BadRequestException("updatedUsers must be an array.");
    }
    const _id = new ObjectId(workspaceId);
    const updatePayload: Partial<Workspace> = {
      users: updatedUsers,
      updatedAt: new Date(),
    };
    try {
      const result = await this.db
        .collection<Workspace>(Collections.WORKSPACE)
        .updateOne({ _id }, { $set: updatePayload });
      if (result.matchedCount === 0) {
        throw new BadRequestException("Workspace not found.");
      }
      return result;
    } catch (error) {
      console.error("Error updating workspace users:", error);
      throw new BadRequestException("Failed to update workspace users.");
    }
  }
}
