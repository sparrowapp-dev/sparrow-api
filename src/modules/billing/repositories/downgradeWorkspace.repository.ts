import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Workspace } from "@src/modules/common/models/workspace.model";
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

  delete(id: string): Promise<DeleteResult> {
    const _id = new ObjectId(id);
    return this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .deleteOne({ _id });
  }
}
