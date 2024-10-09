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
import {
  Collection,
  CollectionBranch,
  ItemTypeEnum,
} from "@src/modules/common/models/collection.model";
import { ContextService } from "@src/modules/common/services/context.service";
import { WorkspaceService } from "./workspace.service";
import { BranchRepository } from "../repositories/branch.repository";
import { Branch } from "@src/modules/common/models/branch.model";
import { UpdateBranchDto } from "../payloads/branch.payload";
import { ConfigService } from "@nestjs/config";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { UpdatesType } from "@src/modules/common/enum/updates.enum";
import { ProducerService } from "@src/modules/common/services/kafka/producer.service";
import { PostmanParserService } from "@src/modules/common/services/postman.parser.service";

@Injectable()
export class CollectionService {
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly branchRepository: BranchRepository,
    private readonly contextService: ContextService,
    private readonly workspaceService: WorkspaceService,
    private readonly configService: ConfigService,
    private readonly producerService: ProducerService,
    private readonly postmanParserService: PostmanParserService,
  ) {}

  async createCollection(
    createCollectionDto: Partial<CreateCollectionDto>,
  ): Promise<InsertOneResult> {
    const workspace = await this.workspaceService.IsWorkspaceAdminOrEditor(
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
    const collection = await this.collectionRepository.addCollection(
      newCollection,
    );
    const updateMessage = `New Collection "${createCollectionDto.name}" is added in "${workspace.name}" workspace`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        type: UpdatesType.COLLECTION,
        workspaceId: createCollectionDto.workspaceId,
      }),
    });
    return collection;
  }

  async getCollection(id: string): Promise<WithId<Collection>> {
    return await this.collectionRepository.get(id);
  }

  async getAllCollections(id: string): Promise<WithId<Collection>[]> {
    const user = await this.contextService.get("user");
    await this.checkPermission(id, user._id);

    const workspace = await this.workspaceRepository.get(id);
    const collections = [];
    for (let i = 0; i < workspace.collection?.length; i++) {
      const collection = await this.collectionRepository.get(
        workspace.collection[i].id.toString(),
      );
      collections.push(collection);
    }
    return collections;
  }

  async getActiveSyncedCollection(
    title: string,
    workspaceId: string,
  ): Promise<WithId<Collection>> {
    return await this.collectionRepository.getActiveSyncedCollection(
      title,
      workspaceId,
    );
  }

  async getActiveSyncedBranch(
    id: string,
    name: string,
  ): Promise<WithId<Branch> | null> {
    const collection = await this.getCollection(id);
    for (const branch of collection.branches) {
      if (branch.name === name) {
        return await this.branchRepository.getBranch(branch.id);
      }
    }
    return null;
  }

  async checkPermission(workspaceId: string, userid: ObjectId): Promise<void> {
    const workspace = await this.workspaceRepository.get(workspaceId);
    const hasPermission = workspace.users.some((user) => {
      return user.id.toString() === userid.toString();
    });
    if (!hasPermission) {
      throw new UnauthorizedException("You don't have a access");
    }
  }
  async updateCollection(
    collectionId: string,
    updateCollectionDto: Partial<UpdateCollectionDto>,
    workspaceId: string,
  ): Promise<UpdateResult> {
    const workspace = await this.workspaceService.IsWorkspaceAdminOrEditor(
      workspaceId,
    );
    const user = await this.contextService.get("user");
    await this.checkPermission(workspaceId, user._id);
    const collection = await this.collectionRepository.get(collectionId);
    const data = await this.collectionRepository.update(
      collectionId,
      updateCollectionDto,
    );
    if (updateCollectionDto?.name) {
      const updateMessage = `"${collection.name}" collection is renamed to "${updateCollectionDto.name}" in "${workspace.name}" workspace`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.COLLECTION,
          workspaceId: workspaceId,
        }),
      });
    }
    if (updateCollectionDto?.description) {
      const updateMessage = `"${collection.name}" collection description is updated under "${workspace.name}" workspace`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.COLLECTION,
          workspaceId: workspaceId,
        }),
      });
    }
    return data;
  }

  async updateBranchArray(
    collectionId: string,
    branch: CollectionBranch,
    workspaceId: string,
  ): Promise<UpdateResult> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(workspaceId);
    const user = await this.contextService.get("user");
    await this.checkPermission(workspaceId, user._id);
    await this.collectionRepository.get(collectionId);
    const data = await this.collectionRepository.updateBranchArray(
      collectionId,
      branch,
    );
    return data;
  }

  async deleteCollection(
    id: string,
    workspaceId: string,
  ): Promise<DeleteResult> {
    const workspace = await this.workspaceService.IsWorkspaceAdminOrEditor(
      workspaceId,
    );
    const user = await this.contextService.get("user");
    await this.checkPermission(workspaceId, user._id);
    const collection = await this.getCollection(id);
    const data = await this.collectionRepository.delete(id);
    const updateMessage = `"${collection.name}" collection is deleted from "${workspace.name}" workspace`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        type: UpdatesType.COLLECTION,
        workspaceId: workspaceId,
      }),
    });
    return data;
  }
  async importCollection(collection: Collection): Promise<InsertOneResult> {
    return await this.collectionRepository.addCollection(collection);
  }
  async updateImportedCollection(
    id: string,
    collection: Partial<Collection>,
  ): Promise<UpdateResult<Collection>> {
    return await this.collectionRepository.updateCollection(id, collection);
  }

  async getBranchData(
    collectionId: string,
    branchName: string,
  ): Promise<WithId<Branch> | void> {
    const branch = await this.branchRepository.getBranchByCollection(
      collectionId,
      branchName,
    );
    for (let index = 0; index < branch?.items.length; index++) {
      if (branch?.items[index].type === ItemTypeEnum.FOLDER) {
        for (let flag = 0; flag < branch.items[index].items.length; flag++) {
          const deletedDate = new Date(
            branch.items[index].items[flag].updatedAt,
          );
          const currentDate = new Date();
          const diff = currentDate.getTime() - deletedDate.getTime();
          const differenceInDays =
            diff / this.configService.get("app.timeToDaysDivisor");
          if (
            branch.items[index].items[flag].isDeleted &&
            differenceInDays >
              this.configService.get("app.deletedAPILimitInDays")
          ) {
            branch.items[index].items.splice(flag, 1);
          }
        }
      } else {
        const deletedDate = new Date(branch.items[index].updatedAt);
        const currentDate = new Date();
        const diff = currentDate.getTime() - deletedDate.getTime();
        if (
          branch.items[index].isDeleted &&
          diff > this.configService.get("app.deletedAPILimitInDays")
        ) {
          branch.items.splice(index, 1);
        }
      }
    }
    const updatedBranch: UpdateBranchDto = {
      items: branch.items,
      updatedAt: new Date(),
      updatedBy: this.contextService.get("user")._id,
    };
    await this.branchRepository.updateBranchById(
      branch._id.toJSON(),
      updatedBranch,
    );
    return branch;
  }

  /**
   * Imports a Postman collection from a JSON object and add it to a workspace.
   *
   * @param jsonObj - The Postman collection JSON object as a string.
   * @param workspaceId - The ID of the workspace to which the collection will be added.
   *
   * @returns A promise that resolves to the details of the imported collection and return the collection.
   *
   */
  async importPostmanCollection(
    jsonObj: string,
    workspaceId: string,
  ): Promise<WithId<Collection>> {
    const updatedCollection =
      await this.postmanParserService.parsePostmanCollection(jsonObj);
    const newCollection = await this.importCollection(updatedCollection);
    const collectionDetails = await this.getCollection(
      newCollection.insertedId.toString(),
    );
    await this.workspaceService.addCollectionInWorkSpace(workspaceId, {
      id: new ObjectId(collectionDetails._id),
      name: collectionDetails.name,
    });
    return collectionDetails;
  }
}
