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
@Injectable()
export class CollectionRequestService {
  constructor(
    private readonly collectionReposistory: CollectionRepository,
    private readonly workspaceReposistory: WorkspaceRepository,
    private readonly contextService: ContextService,
    private readonly collectionService: CollectionService,
    private readonly workspaceService: WorkspaceService,
    private readonly branchRepository: BranchRepository,
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
    return collection.items[index];
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
      return requestObj.items[0];
    }
  }

  async updateRequest(
    collectionId: string,
    requestId: string,
    request: Partial<CollectionRequestDto>,
  ): Promise<CollectionRequestItem> {
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
    return collection;
  }

  async deleteRequest(
    collectionId: string,
    requestId: string,
    noOfRequests: number,
    requestDto: Partial<CollectionRequestDto>,
  ): Promise<UpdateResult<Collection>> {
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
