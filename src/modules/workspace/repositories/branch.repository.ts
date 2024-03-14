import { Inject, Injectable } from "@nestjs/common";

import { Db, InsertOneResult, ObjectId, WithId } from "mongodb";

import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { ContextService } from "@src/modules/common/services/context.service";
import { Branch } from "@src/modules/common/models/branch.model";
import { CollectionItem } from "@src/modules/common/models/collection.model";
import { UpdateBranchDto } from "../payloads/branch.payload";

@Injectable()
export class BranchRepository {
  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
    private readonly contextService: ContextService,
  ) {}

  async addBranch(branch: Branch): Promise<InsertOneResult<Branch>> {
    const response = await this.db
      .collection<Branch>(Collections.BRANCHES)
      .insertOne(branch);
    return response;
  }
  async updateBranch(branchId: string, items: CollectionItem[]): Promise<void> {
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: this.contextService.get("user")._id,
    };
    await this.db.collection<Branch>(Collections.BRANCHES).updateOne(
      {
        _id: new Object(branchId),
      },
      {
        $set: {
          items,
          ...defaultParams,
        },
      },
    );
  }
  async getBranch(branchId: string): Promise<WithId<Branch>> {
    const response = await this.db
      .collection<Branch>(Collections.BRANCHES)
      .findOne({ _id: new ObjectId(branchId) });
    return response;
  }

  async getBranchByCollection(
    collectionId: string,
    branchName: string,
  ): Promise<WithId<Branch>> {
    const collectionObjectId = new ObjectId(collectionId);
    const response = await this.db
      .collection<Branch>(Collections.BRANCHES)
      .findOne({ collectionId: collectionObjectId, name: branchName });
    return response;
  }

  async updateBranchById(
    branchId: string,
    updateParams: UpdateBranchDto,
  ): Promise<WithId<Branch>> {
    const updatedBranchParams = {
      $set: updateParams,
    };
    const responseData = await this.db
      .collection<Branch>(Collections.BRANCHES)
      .findOneAndUpdate({ _id: new ObjectId(branchId) }, updatedBranchParams);
    return responseData.value;
  }
}
