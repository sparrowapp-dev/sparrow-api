import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { UpdateCollectionDto } from "../payloads/collection.payload";
import {
  Db,
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { ContextService } from "@src/modules/common/services/context.service";
import {
  Collection,
  CollectionItem,
  ItemTypeEnum,
} from "@src/modules/common/models/collection.model";
import {
  CollectionRequestDto,
  CollectionRequestItem,
} from "../payloads/collectionRequest.payload";
import { ErrorMessages } from "@src/modules/common/enum/error-messages.enum";
@Injectable()
export class CollectionRepository {
  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
    private readonly contextService: ContextService,
  ) {}
  async addCollection(collection: Collection): Promise<InsertOneResult> {
    const response = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .insertOne(collection);
    return response;
  }

  async get(id: string): Promise<WithId<Collection>> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .findOne({ _id });
    if (!data) {
      throw new BadRequestException("Collection Not Found");
    }
    return data;
  }
  async update(
    id: string,
    updateCollectionDto: UpdateCollectionDto,
  ): Promise<UpdateResult> {
    const collectionId = new ObjectId(id);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: this.contextService.get("user")._id,
    };
    const data = await this.db
      .collection(Collections.COLLECTION)
      .updateOne(
        { _id: collectionId },
        { $set: { ...updateCollectionDto, ...defaultParams } },
      );
    return data;
  }
  async delete(id: string): Promise<DeleteResult> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection(Collections.COLLECTION)
      .deleteOne({ _id });
    return data;
  }

  async getCollection(id: string): Promise<Collection> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .findOne({ _id });
    return data;
  }

  async updateCollection(
    id: string,
    payload: Collection,
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .updateOne(
        { _id: _id },
        {
          $set: {
            ...payload,
          },
        },
      );
    return data;
  }

  async addRequest(
    collectionId: string,
    request: CollectionItem,
    noOfRequests: number,
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .updateOne(
        { _id },
        {
          $push: {
            items: request,
          },
          $set: {
            totalRequests: noOfRequests + 1,
          },
        },
      );
    return data;
  }

  async addRequestInFolder(
    collectionId: string,
    request: CollectionItem,
    noOfRequests: number,
    folderId: string,
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    const collection = await this.getCollection(collectionId);
    const isFolderExists = collection.items.some((item) => {
      return item.id === folderId;
    });
    if (isFolderExists) {
      return await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          { _id, "items.name": request.name },
          {
            $push: { "items.$.items": request.items[0] },
            $set: {
              totalRequests: noOfRequests + 1,
            },
          },
        );
    } else {
      throw new BadRequestException(ErrorMessages.Unauthorized);
    }
  }
  async updateRequest(
    collectionId: string,
    requestId: string,
    request: CollectionRequestDto,
  ): Promise<CollectionRequestItem> {
    const _id = new ObjectId(collectionId);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: this.contextService.get("user").name,
    };
    if (request.items.type === ItemTypeEnum.REQUEST) {
      request.items = { ...request.items, ...defaultParams };
      await this.db.collection<Collection>(Collections.COLLECTION).updateOne(
        { _id, "items.id": requestId },
        {
          $set: {
            "items.$": request.items,
            updatedAt: new Date(),
            updatedBy: this.contextService.get("user").name,
          },
        },
      );
      return { ...request.items, id: requestId };
    } else {
      request.items.items = { ...request.items.items, ...defaultParams };
      await this.db.collection<Collection>(Collections.COLLECTION).updateOne(
        {
          _id,
          "items.id": request.folderId,
          "items.items.id": requestId,
        },
        {
          $set: {
            "items.$[i].items.$[j]": request.items.items,
            updatedAt: new Date(),
            updatedBy: this.contextService.get("user").name,
          },
        },
        {
          arrayFilters: [{ "i.id": request.folderId }, { "j.id": requestId }],
        },
      );
      return { ...request.items.items, id: requestId };
    }
  }

  async deleteRequest(
    collectionId: string,
    requestId: string,
    noOfRequests: number,
    folderId?: string,
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    if (folderId) {
      return await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
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
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: this.contextService.get("user").name,
            },
          },
          {
            arrayFilters: [{ "i.id": folderId }],
          },
        );
    } else {
      return await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          { _id },
          {
            $pull: {
              items: {
                id: requestId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: this.contextService.get("user").name,
            },
          },
        );
    }
  }

  async getActiveSyncedCollection(uuid: string): Promise<WithId<Collection>> {
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .findOne({ uuid });
    return data;
  }
}
