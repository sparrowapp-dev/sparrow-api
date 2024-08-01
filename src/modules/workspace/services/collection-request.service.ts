import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { CollectionRepository } from "../repositories/collection.repository";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import { ObjectId, UpdateResult } from "mongodb";
import { ContextService } from "@src/modules/common/services/context.service";
import {
  CollectionRequestDto,
  CollectionRequestItem,
  DeleteFolderDto,
  FolderDto,
} from "../payloads/collectionRequest.payload";
import { v4 as uuidv4 } from "uuid";
import {
  Collection,
  CollectionItem,
  ItemTypeEnum,
  SourceTypeEnum,
} from "@src/modules/common/models/collection.model";
import { CollectionService } from "./collection.service";
import { WorkspaceService } from "./workspace.service";
import { BranchRepository } from "../repositories/branch.repository";
import { UpdateBranchDto } from "../payloads/branch.payload";
import { Branch } from "@src/modules/common/models/branch.model";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { UpdatesType } from "@src/modules/common/enum/updates.enum";
import { ProducerService } from "@src/modules/common/services/kafka/producer.service";
@Injectable()
export class CollectionRequestService {
  constructor(
    private readonly collectionReposistory: CollectionRepository,
    private readonly workspaceReposistory: WorkspaceRepository,
    private readonly contextService: ContextService,
    private readonly collectionService: CollectionService,
    private readonly workspaceService: WorkspaceService,
    private readonly branchRepository: BranchRepository,
    private readonly producerService: ProducerService,
  ) {}

  async addFolder(payload: Partial<FolderDto>): Promise<CollectionItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(payload.workspaceId);
    const user = await this.contextService.get("user");
    const uuid = uuidv4();
    await this.checkPermission(payload.workspaceId, user._id);
    const collection = await this.collectionReposistory.getCollection(
      payload.collectionId,
    );
    if (!collection) {
      throw new BadRequestException("Collection Not Found");
    }
    const updatedFolder: CollectionItem = {
      id: uuid,
      name: payload.name,
      description: payload.description ?? "",
      type: ItemTypeEnum.FOLDER,
      source: payload.source ?? SourceTypeEnum.USER,
      isDeleted: false,
      items: [],
      createdBy: user.name,
      updatedBy: user.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    collection.items.push(updatedFolder);
    await this.collectionReposistory.updateCollection(
      payload.collectionId,
      collection,
    );
    if (payload?.currentBranch) {
      const branch = await this.branchRepository.getBranchByCollection(
        payload.collectionId,
        payload.currentBranch,
      );
      if (!branch) {
        throw new BadRequestException("Branch Not Found");
      }
      branch.items.push(updatedFolder);
      const updatedBranch: UpdateBranchDto = {
        items: branch.items,
        updatedAt: new Date(),
        updatedBy: this.contextService.get("user")._id,
      };
      await this.branchRepository.updateBranchById(
        branch._id.toString(),
        updatedBranch,
      );
    }
    const updateMessage = `New Folder "${payload?.name}" is added in "${collection.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        type: UpdatesType.FOLDER,
        workspaceId: payload.workspaceId,
      }),
    });
    return updatedFolder;
  }

  async isFolderExist(branch: Branch, id: string): Promise<number> {
    for (let i = 0; i < branch.items.length; i++) {
      if (branch.items[i].id === id) {
        return i;
      }
    }
    throw new BadRequestException("Folder Doesn't Exist");
  }

  async updateFolder(payload: Partial<FolderDto>): Promise<CollectionItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(payload.workspaceId);
    const user = await this.contextService.get("user");
    await this.checkPermission(payload.workspaceId, user._id);
    const collection = await this.collectionReposistory.getCollection(
      payload.collectionId,
    );
    if (!collection) {
      throw new BadRequestException("Collection Not Found");
    }
    const index = await this.checkFolderExist(collection, payload.folderId);
    const updateMessage = `"${collection.items[index].name}" folder is renamed to "${payload.name}" in "${collection.name}" collection`;
    collection.items[index].name = payload.name ?? collection.items[index].name;
    collection.items[index].description =
      payload.description ?? collection.items[index].description;
    await this.collectionReposistory.updateCollection(
      payload.collectionId,
      collection,
    );
    if (payload?.currentBranch) {
      const branch = await this.branchRepository.getBranchByCollection(
        payload.collectionId,
        payload.currentBranch,
      );
      if (!branch) {
        throw new BadRequestException("Branch Not Found");
      }
      const index = await this.isFolderExist(branch, payload.folderId);
      branch.items[index].name = payload.name ?? branch.items[index].name;
      branch.items[index].description =
        payload.description ?? branch.items[index].description;
      const updatedBranch: UpdateBranchDto = {
        items: branch.items,
        updatedAt: new Date(),
        updatedBy: user._id,
      };
      await this.branchRepository.updateBranchById(
        branch._id.toString(),
        updatedBranch,
      );
    }
    if (payload?.name) {
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.FOLDER,
          workspaceId: payload.workspaceId,
        }),
      });
    }
    if (payload?.description) {
      const updateDescriptionMessage = `"${collection.items[index].name}" folder description is updated under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateDescriptionMessage,
          type: UpdatesType.FOLDER,
          workspaceId: payload.workspaceId,
        }),
      });
    }
    return collection.items[index];
  }

  /**
   * Finds an item by its ID within a nested array of items.
   *
   * @param items - The array of items to search through.
   * @param id - The ID of the item to find.
   * @returns A promise that resolves to the found item or null if not found.
   */
  async findItemById(items: any[], id: string): Promise<CollectionItem> {
    for (const item of items) {
      if (item?.id === id) {
        return item;
      }
      if (item?.items && item.items.length > 0) {
        const found = this.findItemById(item.items, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  async deleteFolder(
    payload: DeleteFolderDto,
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(payload.workspaceId);
    const user = await this.contextService.get("user");
    await this.checkPermission(payload.workspaceId, user._id);
    const collection = await this.collectionReposistory.getCollection(
      payload.collectionId,
    );
    if (!collection) {
      throw new BadRequestException("Collection Not Found");
    }
    const folder = await this.findItemById(collection.items, payload.folderId);
    const updatedCollectionItems = collection.items.filter(
      (item) => item.id !== payload.folderId,
    );
    collection.items = updatedCollectionItems;
    const data = await this.collectionReposistory.updateCollection(
      payload.collectionId,
      collection,
    );
    if (payload?.currentBranch) {
      const branch = await this.branchRepository.getBranchByCollection(
        payload.collectionId,
        payload.currentBranch,
      );
      if (!branch) {
        throw new BadRequestException("Branch Not Found");
      }
      const updatedBranchItems = branch.items.filter(
        (item) => item.id !== payload.folderId,
      );
      branch.items = updatedBranchItems;
      const updatedBranch: UpdateBranchDto = {
        items: branch.items,
        updatedAt: new Date(),
        updatedBy: user._id,
      };
      await this.branchRepository.updateBranchById(
        branch._id.toString(),
        updatedBranch,
      );
    }
    const updateMessage = `"${folder?.name}" folder is deleted from "${collection?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        type: UpdatesType.FOLDER,
        workspaceId: payload.workspaceId,
      }),
    });
    return data;
  }

  async checkPermission(workspaceId: string, userid: ObjectId): Promise<void> {
    const workspace = await this.workspaceReposistory.get(workspaceId);
    const hasPermission = workspace.users.some((user) => {
      return user.id.toString() === userid.toString();
    });
    if (!hasPermission) {
      throw new UnauthorizedException(
        "You don't have access of this Workspace",
      );
    }
  }

  async checkFolderExist(collection: Collection, id: string): Promise<number> {
    for (let i = 0; i < collection.items.length; i++) {
      if (collection.items[i].id === id) {
        return i;
      }
    }
    throw new BadRequestException("Folder Doesn't Exist");
  }
  async addRequest(
    collectionId: string,
    request: Partial<CollectionRequestDto>,
    noOfRequests: number,
    userName: string,
    folderId?: string,
  ): Promise<CollectionItem> {
    const uuid = uuidv4();
    const collection = await this.collectionReposistory.getCollection(
      collectionId,
    );
    const requestObj: CollectionItem = {
      id: uuid,
      name: request.items.name,
      type: request.items.type,
      description: request.items.description,
      source: request.source ?? SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: userName,
      updatedBy: userName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let updateMessage = ``;
    if (request.items.type === ItemTypeEnum.REQUEST) {
      requestObj.request = request.items.request;
      await this.collectionReposistory.addRequest(
        collectionId,
        requestObj,
        noOfRequests,
      );
      if (request?.currentBranch) {
        await this.branchRepository.addRequestInBranch(
          collectionId,
          request.currentBranch,
          requestObj,
        );
      }
      updateMessage = `New API request "${request.items.name}" is saved in "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
      return requestObj;
    } else {
      requestObj.items = [
        {
          id: uuidv4(),
          name: request.items.items.name,
          type: request.items.items.type,
          description: request.items.items.description,
          request: { ...request.items.items.request },
          source: SourceTypeEnum.USER,
          createdBy: userName,
          updatedBy: userName,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await this.collectionReposistory.addRequestInFolder(
        collectionId,
        requestObj,
        noOfRequests,
        folderId,
      );
      if (request?.currentBranch) {
        await this.branchRepository.addRequestInBranchFolder(
          collectionId,
          request.currentBranch,
          requestObj,
          folderId,
        );
      }
      updateMessage = `New API request "${request.items.items.name}" is saved in "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
      return requestObj.items[0];
    }
  }

  async updateRequest(
    collectionId: string,
    requestId: string,
    request: Partial<CollectionRequestDto>,
  ): Promise<CollectionRequestItem> {
    const collectionData = await this.collectionReposistory.getCollection(
      collectionId,
    );
    const requestData = await this.findItemById(
      collectionData.items,
      requestId,
    );
    const collection = await this.collectionReposistory.updateRequest(
      collectionId,
      requestId,
      request,
    );
    if (request?.currentBranch) {
      await this.branchRepository.updateRequestInBranch(
        collectionId,
        request.currentBranch,
        requestId,
        request,
      );
    }
    if (requestData?.name !== request?.items?.name) {
      const updateMessage = `"${requestData.name}" API is renamed to "${request.items.name}" in "${collectionData.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
    }
    if (requestData?.description === "" && request?.items?.description) {
      const updateMessage = `API documentation is added for "${request.items.name}" API in "${collectionData.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
    } else if (requestData?.description !== request?.items?.description) {
      const updateMessage = `API documentation is updated for "${request.items.name}" API in "${collectionData.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
    }
    return collection;
  }

  async deleteRequest(
    collectionId: string,
    requestId: string,
    noOfRequests: number,
    requestDto: Partial<CollectionRequestDto>,
  ): Promise<UpdateResult<Collection>> {
    const collectionData = await this.collectionReposistory.getCollection(
      collectionId,
    );
    const requestData = await this.findItemById(
      collectionData.items,
      requestId,
    );
    const collection = await this.collectionReposistory.deleteRequest(
      collectionId,
      requestId,
      noOfRequests,
      requestDto?.folderId,
    );
    if (requestDto.currentBranch) {
      await this.branchRepository.deleteRequestInBranch(
        collectionId,
        requestDto.currentBranch,
        requestId,
        requestDto.folderId,
      );
    }
    const updateMessage = `API request "${requestData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        type: UpdatesType.REQUEST,
        workspaceId: requestDto.workspaceId,
      }),
    });
    return collection;
  }

  async getNoOfRequest(collectionId: string): Promise<number> {
    const data = await this.collectionReposistory.get(collectionId);
    let noOfRequests = 0;
    if (data.items.length > 0) {
      data.items.map((item) => {
        if (item.type === ItemTypeEnum.REQUEST) {
          noOfRequests = noOfRequests + 1;
        } else if (item.type === ItemTypeEnum.FOLDER) {
          noOfRequests = noOfRequests + item.items.length;
        }
      });
    }
    return noOfRequests;
  }
}
