import { Injectable, UnauthorizedException } from "@nestjs/common";

import {
  CreateCollectionDto,
  UpdateCollectionDto,
} from "../payloads/collection.payload";
import { CollectionRepository } from "../repositories/collection.repository";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import {
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";
import { Collection } from "@src/modules/common/models/collection.model";
import { ContextService } from "@src/modules/common/services/context.service";
import { ErrorMessages } from "@src/modules/common/enum/error-messages.enum";
import { WorkspaceService } from "./workspace.service";

@Injectable()
export class CollectionService {
  constructor(
    private readonly collectionReposistory: CollectionRepository,
    private readonly workspaceReposistory: WorkspaceRepository,
    private readonly contextService: ContextService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async createCollection(
    createCollectionDto: CreateCollectionDto,
  ): Promise<InsertOneResult> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      createCollectionDto.workspaceId,
    );
    const user = await this.contextService.get("user");
    await this.checkPermission(createCollectionDto.workspaceId, user._id);

    const newCollection: Collection = {
      name: createCollectionDto.name,
      totalRequests: 0,
      createdBy: user.name,
      items: [],
      updatedBy: user.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const collection = await this.collectionReposistory.addCollection(
      newCollection,
    );
    return collection;
  }

  async getCollection(id: string): Promise<WithId<Collection>> {
    return await this.collectionReposistory.get(id);
  }

  async getAllCollections(id: string): Promise<WithId<Collection>[]> {
    const user = await this.contextService.get("user");
    await this.checkPermission(id, user._id);

    const workspace = await this.workspaceReposistory.get(id);
    const collections = [];
    for (let i = 0; i < workspace.collection?.length; i++) {
      const collection = await this.collectionReposistory.get(
        workspace.collection[i].id.toString(),
      );
      collections.push(collection);
    }
    return collections;
  }

  async getActiveSyncedCollection(title: string): Promise<WithId<Collection>> {
    return await this.collectionReposistory.getActiveSyncedCollection(title);
  }

  async checkPermission(workspaceId: string, userid: ObjectId): Promise<void> {
    const workspace = await this.workspaceReposistory.get(workspaceId);
    const hasPermission = workspace.users.some((user) => {
      return user.id.toString() === userid.toString();
    });
    if (!hasPermission) {
      throw new UnauthorizedException(ErrorMessages.Unauthorized);
    }
  }
  async updateCollection(
    collectionId: string,
    updateCollectionDto: UpdateCollectionDto,
    workspaceId: string,
  ): Promise<UpdateResult> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(workspaceId);
    const user = await this.contextService.get("user");
    await this.checkPermission(workspaceId, user._id);
    await this.collectionReposistory.get(collectionId);
    const data = await this.collectionReposistory.update(
      collectionId,
      updateCollectionDto,
    );
    return data;
  }

  async deleteCollection(
    id: string,
    workspaceId: string,
  ): Promise<DeleteResult> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(workspaceId);
    const user = await this.contextService.get("user");
    await this.checkPermission(workspaceId, user._id);
    const data = await this.collectionReposistory.delete(id);
    return data;
  }
  async importCollection(collection: Collection): Promise<InsertOneResult> {
    return await this.collectionReposistory.addCollection(collection);
  }
  async updateImportedCollection(
    id: string,
    collection: Collection,
  ): Promise<UpdateResult<Collection>> {
    return await this.collectionReposistory.updateCollection(id, collection);
  }
}
