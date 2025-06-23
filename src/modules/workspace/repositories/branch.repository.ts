import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { Db, InsertOneResult, ObjectId, UpdateResult, WithId } from "mongodb";

import { Collections } from "@src/modules/common/enum/database.collection.enum";

import { Branch } from "@src/modules/common/models/branch.model";
import {
  CollectionItem,
  ItemTypeEnum,
} from "@src/modules/common/models/collection.model";
import { UpdateBranchDto } from "../payloads/branch.payload";
import { ErrorMessages } from "@src/modules/common/enum/error-messages.enum";
import {
  CollectionRequestDto,
  CollectionRequestItem,
} from "../payloads/collectionRequest.payload";

@Injectable()
export class BranchRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async addBranch(branch: Branch): Promise<InsertOneResult<Branch>> {
    const response = await this.db
      .collection<Branch>(Collections.BRANCHES)
      .insertOne(branch);
    return response;
  }
  async updateBranch(
    branchId: string,
    items: CollectionItem[],
    userId: ObjectId,
  ): Promise<void> {
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: userId.toString(),
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

  async addRequestInBranch(
    collectionId: string,
    branchName: string,
    request: CollectionItem,
  ): Promise<UpdateResult<Branch>> {
    const branch = await this.getBranchByCollection(collectionId, branchName);
    const _id = branch._id;
    const data = await this.db
      .collection<Branch>(Collections.BRANCHES)
      .updateOne(
        { _id },
        {
          $push: {
            items: request,
          },
        },
      );
    return data;
  }

  async addRequestInBranchFolder(
    collectionId: string,
    branchName: string,
    request: CollectionItem,
    folderId: string,
  ): Promise<UpdateResult<Branch>> {
    const branch = await this.getBranchByCollection(collectionId, branchName);
    const _id = branch._id;
    const isFolderExists = branch.items.some((item) => {
      return item.id === folderId;
    });
    if (isFolderExists) {
      return await this.db.collection<Branch>(Collections.BRANCHES).updateOne(
        { _id, "items.name": request.name },
        {
          $push: { "items.$.items": request.items[0] },
        },
      );
    } else {
      throw new BadRequestException(ErrorMessages.Unauthorized);
    }
  }

  async updateRequestInBranch(
    collectionId: string,
    branchName: string,
    requestId: string,
    request: Partial<CollectionRequestDto>,
    userId: ObjectId,
  ): Promise<CollectionRequestItem> {
    const branch = await this.getBranchByCollection(collectionId, branchName);
    const _id = branch._id;
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: userId.toString(),
    };
    if (request.items.type === ItemTypeEnum.REQUEST) {
      request.items = { ...request.items, ...defaultParams };
      await this.db.collection<Branch>(Collections.BRANCHES).updateOne(
        { _id, "items.id": requestId },
        {
          $set: {
            "items.$": request.items,
            updatedAt: new Date(),
            updatedBy: userId.toString(),
          },
        },
      );
      return { ...request.items, id: requestId };
    } else {
      request.items.items = { ...request.items.items, ...defaultParams };
      await this.db.collection<Branch>(Collections.BRANCHES).updateOne(
        {
          _id,
          "items.id": request.folderId,
          "items.items.id": requestId,
        },
        {
          $set: {
            "items.$[i].items.$[j]": request.items.items,
            updatedAt: new Date(),
            updatedBy: userId.toString(),
          },
        },
        {
          arrayFilters: [{ "i.id": request.folderId }, { "j.id": requestId }],
        },
      );
      return { ...request.items.items, id: requestId };
    }
  }

  async deleteRequestInBranch(
    collectionId: string,
    branchName: string,
    requestId: string,
    userId: ObjectId,
    folderId?: string,
  ): Promise<UpdateResult<Branch>> {
    const branch = await this.getBranchByCollection(collectionId, branchName);
    const _id = branch._id;
    if (folderId) {
      return await this.db.collection<Branch>(Collections.BRANCHES).updateOne(
        {
          _id,
        },
        {
          $pull: {
            "items.$[i].items": {
              id: requestId,
            },
          },
          $set: {
            updatedAt: new Date(),
            updatedBy: userId.toString(),
          },
        },
        {
          arrayFilters: [{ "i.id": folderId }],
        },
      );
    } else {
      return await this.db.collection<Branch>(Collections.BRANCHES).updateOne(
        { _id },
        {
          $pull: {
            items: {
              id: requestId,
            },
          },
          $set: {
            updatedAt: new Date(),
            updatedBy: userId.toString(),
          },
        },
      );
    }
  }
}
