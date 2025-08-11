import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { CollectionRepository } from "../repositories/collection.repository";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import { ObjectId, UpdateResult } from "mongodb";
import {
  CollectionGraphQLDto,
  CollectionMockRequestResponseDto,
  CollectionRequestDto,
  CollectionRequestItem,
  CollectionRequestResponseDto,
  CollectionSocketIODto,
  CollectionAiRequestDto,
  CollectionWebSocketDto,
  DeleteFolderDto,
  FolderDto,
  UpdateCollectionMockRequestResponseDto,
  UpdateCollectionRequestResponseDto,
  MockResponseRatioDto,
  UpdateMockResponseRatioDto,
  GeneratedVariablesDto
} from "../payloads/collectionRequest.payload";
import { v4 as uuidv4 } from "uuid";
import {
  Collection,
  CollectionItem,
  ItemTypeEnum,
  SourceTypeEnum,
} from "@src/modules/common/models/collection.model";
import { WorkspaceService } from "./workspace.service";
import { BranchRepository } from "../repositories/branch.repository";
import { UpdateBranchDto } from "../payloads/branch.payload";
import { Branch } from "@src/modules/common/models/branch.model";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { UpdatesType } from "@src/modules/common/enum/updates.enum";
import { ProducerService } from "@src/modules/common/services/event-producer.service";
import { DecodedUserObject } from "@src/types/fastify";
import { EncryptionService } from "@src/modules/common/services/encryption.service";
import { Workspace } from "@src/modules/common/models/workspace.model";
@Injectable()
export class CollectionRequestService {
  constructor(
    private readonly collectionReposistory: CollectionRepository,
    private readonly workspaceReposistory: WorkspaceRepository,
    private readonly workspaceService: WorkspaceService,
    private readonly branchRepository: BranchRepository,
    private readonly producerService: ProducerService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async addFolder(
    payload: Partial<FolderDto>,
    user: DecodedUserObject,
  ): Promise<CollectionItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      payload.workspaceId,
      user._id,
    );
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
        updatedBy: user._id.toString(),
      };
      await this.branchRepository.updateBranchById(
        branch._id.toString(),
        updatedBranch,
      );
    }
    const updateMessage = `New Folder "${payload?.name}" is added in "${collection.name}" collection`;
    const currentWorkspaceObject = new ObjectId(payload.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
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

  async updateFolder(
    payload: Partial<FolderDto>,
    user: DecodedUserObject,
  ): Promise<CollectionItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      payload.workspaceId,
      user._id,
    );
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
    const currentUpdatedAt = new Date();
    const currentUpdatedBy = user._id.toString();
    collection.items[index].updatedAt = currentUpdatedAt;
    collection.items[index].updatedBy = currentUpdatedBy;
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
        updatedBy: user._id.toString(),
      };
      await this.branchRepository.updateBranchById(
        branch._id.toString(),
        updatedBranch,
      );
    }
    const currentWorkspaceObject = new ObjectId(payload.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    if (payload?.name) {
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
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
          user,
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
        const found = await this.findItemById(item.items, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  async deleteFolder(
    payload: DeleteFolderDto,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      payload.workspaceId,
      user._id,
    );
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
        updatedBy: user._id.toString(),
      };
      await this.branchRepository.updateBranchById(
        branch._id.toString(),
        updatedBranch,
      );
    }
    const currentWorkspaceObject = new ObjectId(payload.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `"${folder?.name}" folder is deleted from "${collection?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
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
    user: DecodedUserObject,
    folderId?: string,
  ): Promise<CollectionItem> {
    const uuid = uuidv4();
    const collection =
      await this.collectionReposistory.getCollection(collectionId);
    const requestObj: CollectionItem = {
      id: uuid,
      name: request.items.name,
      type: request.items.type,
      description: request.items.description,
      source: request.source ?? SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: user.name,
      updatedBy: user.name,
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
      const currentWorkspaceObject = new ObjectId(request.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New API request "${request.items.name}" is saved in "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
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
          createdBy: user.name,
          updatedBy: user.name,
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
      const currentWorkspaceObject = new ObjectId(request.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New API request "${request.items.items.name}" is saved in "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
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
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    const collectionData =
      await this.collectionReposistory.getCollection(collectionId);
    const requestData = await this.findItemById(
      collectionData.items,
      requestId,
    );
    const collection = await this.collectionReposistory.updateRequest(
      collectionId,
      requestId,
      request,
      user,
    );
    if (request?.currentBranch) {
      await this.branchRepository.updateRequestInBranch(
        collectionId,
        request.currentBranch,
        requestId,
        request,
        user._id,
      );
    }
    if (
      requestData?.name !== request?.items?.name &&
      requestData?.name &&
      request?.items?.name
    ) {
      const updateMessage = `"${requestData?.name}" API is renamed to "${request?.items?.name}" in "${collectionData.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
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
          user,
          type: UpdatesType.REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
    } else if (
      requestData?.description !== request?.items?.description &&
      request?.items?.description
    ) {
      const updateMessage = `API documentation is updated for "${request.items.name}" API in "${collectionData.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
    }
    const currentWorkspaceObject = new ObjectId(request.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    return collection;
  }

  async deleteRequest(
    collectionId: string,
    requestId: string,
    noOfRequests: number,
    requestDto: Partial<CollectionRequestDto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    const collectionData =
      await this.collectionReposistory.getCollection(collectionId);
    const requestData = await this.findItemById(
      collectionData.items,
      requestId,
    );
    const collection = await this.collectionReposistory.deleteRequest(
      collectionId,
      requestId,
      noOfRequests,
      user,
      requestDto?.folderId,
    );
    if (requestDto.currentBranch) {
      await this.branchRepository.deleteRequestInBranch(
        collectionId,
        requestDto.currentBranch,
        requestId,
        user._id,
        requestDto.folderId,
      );
    }
    const updateMessage = `API request "${requestData?.name}" is deleted from "${collectionData?.name}" collection`;
    const currentWorkspaceObject = new ObjectId(requestDto.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
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
        if (
          item.type === ItemTypeEnum.REQUEST ||
          item.type === ItemTypeEnum.WEBSOCKET ||
          item.type === ItemTypeEnum.SOCKETIO ||
          item.type === ItemTypeEnum.GRAPHQL
        ) {
          noOfRequests = noOfRequests + 1;
        } else if (item.type === ItemTypeEnum.FOLDER) {
          noOfRequests = noOfRequests + item.items.length;
        }
      });
    }
    return noOfRequests;
  }

  /**
   * Adds a new WebSocket to the collection.
   * This method handles both individual WebSockets and folder-based WebSockets.
   *
   * @param websocket - The WebSocket details to be added.
   * @returns The added WebSocket item.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async addWebSocket(
    websocket: Partial<CollectionWebSocketDto>,
    user: DecodedUserObject,
  ): Promise<CollectionItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      websocket.workspaceId,
      user._id,
    );
    await this.checkPermission(websocket.workspaceId, user._id);
    const noOfRequests = await this.getNoOfRequest(websocket.collectionId);
    const uuid = uuidv4();
    const collection = await this.collectionReposistory.getCollection(
      websocket.collectionId,
    );
    const websocketObj: CollectionItem = {
      id: uuid,
      name: websocket.items.name,
      type: websocket.items.type,
      description: websocket.items.description,
      source: websocket.source ?? SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: user?.name,
      updatedBy: user?.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let updateMessage = ``;
    if (websocket.items.type === ItemTypeEnum.WEBSOCKET) {
      websocketObj.websocket = websocket.items.websocket;
      await this.collectionReposistory.addWebSocket(
        websocket.collectionId,
        websocketObj,
        noOfRequests,
      );
      const currentWorkspaceObject = new ObjectId(websocket.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New WebSocket "${websocket.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.WEBSOCKET,
          workspaceId: websocket.workspaceId,
        }),
      });
      return websocketObj;
    } else {
      websocketObj.items = [
        {
          id: uuidv4(),
          name: websocket.items.items.name,
          type: websocket.items.items.type,
          description: websocket.items.items.description,
          websocket: { ...websocket.items.items.websocket },
          source: SourceTypeEnum.USER,
          createdBy: user?.name,
          updatedBy: user?.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await this.collectionReposistory.addWebSocketInFolder(
        websocket.collectionId,
        websocketObj,
        noOfRequests,
        websocket?.folderId,
      );
      const currentWorkspaceObject = new ObjectId(websocket.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New WebSocket "${websocket.items.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.WEBSOCKET,
          workspaceId: websocket.workspaceId,
        }),
      });
      return websocketObj.items[0];
    }
  }

  /**
   * Updates an existing WebSocket in the collection.
   *
   * @param websocketId - The ID of the WebSocket to be updated.
   * @param websocket - The updated WebSocket details.
   * @returns The updated WebSocket item.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async updateWebSocket(
    websocketId: string,
    websocket: Partial<CollectionWebSocketDto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      websocket.workspaceId,
      user._id,
    );
    await this.checkPermission(websocket.workspaceId, user._id);
    const collection = await this.collectionReposistory.updateWebSocket(
      websocket.collectionId,
      websocketId,
      websocket,
      user,
    );
    const collectionData = await this.collectionReposistory.getCollection(
      websocket.collectionId,
    );
    const currentWorkspaceObject = new ObjectId(websocket.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `WebSocket "${
      websocket?.items?.name ?? websocket?.items?.items?.name
    }" is updated under "${collectionData.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.WEBSOCKET,
        workspaceId: websocket.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Deletes an existing WebSocket from the collection.
   *
   * @param websocketId - The ID of the WebSocket to be deleted.
   * @param websocketDto - The WebSocket details including collection ID and folder ID (if applicable).
   * @returns The result of the update operation.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async deleteWebSocket(
    websocketId: string,
    websocketDto: Partial<CollectionWebSocketDto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      websocketDto.workspaceId,
      user._id,
    );
    await this.checkPermission(websocketDto.workspaceId, user._id);
    const noOfRequests = await this.getNoOfRequest(websocketDto.collectionId);
    const collectionData = await this.collectionReposistory.getCollection(
      websocketDto.collectionId,
    );
    const websocketData = await this.findItemById(
      collectionData.items,
      websocketId,
    );
    const collection = await this.collectionReposistory.deleteWebSocket(
      websocketDto.collectionId,
      websocketId,
      noOfRequests,
      user,
      websocketDto?.folderId,
    );
    const currentWorkspaceObject = new ObjectId(websocketDto.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `WebSocket "${websocketData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.WEBSOCKET,
        workspaceId: websocketDto.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Adds a new Socket.IO to the collection.
   * This method handles both individual SocketIO and folder-based SocketIO.
   *
   * @param socketio - The SocketIO details to be added.
   * @returns The added SocketIO item.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async addSocketIO(
    socketio: Partial<CollectionSocketIODto>,
    user: DecodedUserObject,
  ): Promise<CollectionItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      socketio.workspaceId,
      user._id,
    );
    await this.checkPermission(socketio.workspaceId, user._id);
    const noOfRequests = await this.getNoOfRequest(socketio.collectionId);
    const uuid = uuidv4();
    const collection = await this.collectionReposistory.getCollection(
      socketio.collectionId,
    );
    const socketioObj: CollectionItem = {
      id: uuid,
      name: socketio.items.name,
      type: socketio.items.type,
      description: socketio.items.description,
      source: socketio.source ?? SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: user?.name,
      updatedBy: user?.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let updateMessage = ``;
    if (socketio.items.type === ItemTypeEnum.SOCKETIO) {
      socketioObj.socketio = socketio.items.socketio;
      await this.collectionReposistory.addSocketIO(
        socketio.collectionId,
        socketioObj,
        noOfRequests,
      );
      const currentWorkspaceObject = new ObjectId(socketio.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New Socket.IO "${socketio.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.SOCKETIO,
          workspaceId: socketio.workspaceId,
        }),
      });
      return socketioObj;
    } else {
      socketioObj.items = [
        {
          id: uuidv4(),
          name: socketio.items.items.name,
          type: socketio.items.items.type,
          description: socketio.items.items.description,
          socketio: { ...socketio.items.items.socketio },
          source: SourceTypeEnum.USER,
          createdBy: user?.name,
          updatedBy: user?.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await this.collectionReposistory.addSocketIOInFolder(
        socketio.collectionId,
        socketioObj,
        noOfRequests,
        socketio?.folderId,
      );
      const currentWorkspaceObject = new ObjectId(socketio.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New Socket.IO "${socketio.items.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.SOCKETIO,
          workspaceId: socketio.workspaceId,
        }),
      });
      return socketioObj.items[0];
    }
  }

  /**
   * Updates an existing Socket.IO in the collection.
   *
   * @param socketioId - The ID of the Socket.IO to be updated.
   * @param socketio - The updated Socket.IO details.
   * @returns The updated Socket.IO item.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async updateSocketIO(
    socketioId: string,
    socketio: Partial<CollectionSocketIODto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      socketio.workspaceId,
      user._id,
    );
    await this.checkPermission(socketio.workspaceId, user._id);
    const collection = await this.collectionReposistory.updateSocketIO(
      socketio.collectionId,
      socketioId,
      socketio,
      user,
    );
    const collectionData = await this.collectionReposistory.getCollection(
      socketio.collectionId,
    );
    const currentWorkspaceObject = new ObjectId(socketio.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `Socket.IO "${
      socketio?.items?.name ?? socketio?.items?.items?.name
    }" is updated under "${collectionData.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.SOCKETIO,
        workspaceId: socketio.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Deletes an existing Socket.IO from the collection.
   *
   * @param socketioId - The ID of the Socket.IO to be deleted.
   * @param socketioDto - The Socket.IO details including collection ID and folder ID (if applicable).
   * @returns The result of the update operation.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async deleteSocketIO(
    socketioId: string,
    socketioDto: Partial<CollectionSocketIODto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      socketioDto.workspaceId,
      user._id,
    );
    await this.checkPermission(socketioDto.workspaceId, user._id);
    const noOfRequests = await this.getNoOfRequest(socketioDto.collectionId);
    const collectionData = await this.collectionReposistory.getCollection(
      socketioDto.collectionId,
    );
    const socketioData = await this.findItemById(
      collectionData.items,
      socketioId,
    );
    const collection = await this.collectionReposistory.deleteSocketIO(
      socketioDto.collectionId,
      socketioId,
      noOfRequests,
      user,
      socketioDto?.folderId,
    );
    const currentWorkspaceObject = new ObjectId(socketioDto.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `Socket.IO "${socketioData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.SOCKETIO,
        workspaceId: socketioDto.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Adds a new GraphQL to the collection.
   * This method handles both individual GraphQL and folder-based GraphQL.
   *
   * @param graphql - The GraphQL details to be added.
   * @returns The added GraphQL item.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async addGraphQL(
    graphql: Partial<CollectionGraphQLDto>,
    user: DecodedUserObject,
  ): Promise<CollectionItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      graphql.workspaceId,
      user._id,
    );
    await this.checkPermission(graphql.workspaceId, user._id);
    const noOfRequests = await this.getNoOfRequest(graphql.collectionId);
    const uuid = uuidv4();
    const collection = await this.collectionReposistory.getCollection(
      graphql.collectionId,
    );
    const graphqlObj: CollectionItem = {
      id: uuid,
      name: graphql.items.name,
      type: graphql.items.type,
      description: graphql.items.description,
      source: graphql.source ?? SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: user?.name,
      updatedBy: user?.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let updateMessage = ``;
    if (graphql.items.type === ItemTypeEnum.GRAPHQL) {
      graphqlObj.graphql = graphql.items.graphql;
      await this.collectionReposistory.addGraphQL(
        graphql.collectionId,
        graphqlObj,
        noOfRequests,
      );
      const currentWorkspaceObject = new ObjectId(graphql.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New GraphQL "${graphql.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.GRAPHQL,
          workspaceId: graphql.workspaceId,
        }),
      });
      return graphqlObj;
    } else {
      graphqlObj.items = [
        {
          id: uuidv4(),
          name: graphql.items.items.name,
          type: graphql.items.items.type,
          description: graphql.items.items.description,
          graphql: { ...graphql.items.items.graphql },
          source: SourceTypeEnum.USER,
          createdBy: user?.name,
          updatedBy: user?.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await this.collectionReposistory.addGraphQLInFolder(
        graphql.collectionId,
        graphqlObj,
        noOfRequests,
        graphql?.folderId,
      );
      const currentWorkspaceObject = new ObjectId(graphql.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New GraphQL "${graphql.items.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.GRAPHQL,
          workspaceId: graphql.workspaceId,
        }),
      });
      return graphqlObj.items[0];
    }
  }

  /**
   * Updates an existing GraphQL in the collection.
   *
   * @param graphqlId - The ID of the GraphQL to be updated.
   * @param graphql - The updated GraphQL details.
   * @returns The updated GraphQL item.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async updateGraphQL(
    graphqlId: string,
    graphql: Partial<CollectionGraphQLDto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      graphql.workspaceId,
      user._id,
    );
    await this.checkPermission(graphql.workspaceId, user._id);
    const collection = await this.collectionReposistory.updateGraphQL(
      graphql.collectionId,
      graphqlId,
      graphql,
      user,
    );
    const collectionData = await this.collectionReposistory.getCollection(
      graphql.collectionId,
    );
    const currentWorkspaceObject = new ObjectId(graphql.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `GraphQL "${
      graphql?.items?.name ?? graphql?.items?.items?.name
    }" is updated under "${collectionData.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.GRAPHQL,
        workspaceId: graphql.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Deletes an existing GraphQL from the collection.
   *
   * @param graphqlId - The ID of the GraphQL to be deleted.
   * @param graphqlDto - The GraphQL details including collection ID and folder ID (if applicable).
   * @returns The result of the update operation.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async deleteGraphQL(
    graphqlId: string,
    graphqlDto: Partial<CollectionGraphQLDto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      graphqlDto.workspaceId,
      user._id,
    );
    await this.checkPermission(graphqlDto.workspaceId, user._id);
    const noOfRequests = await this.getNoOfRequest(graphqlDto.collectionId);
    const collectionData = await this.collectionReposistory.getCollection(
      graphqlDto.collectionId,
    );
    const graphqlData = await this.findItemById(
      collectionData.items,
      graphqlId,
    );
    const collection = await this.collectionReposistory.deleteGraphQL(
      graphqlDto.collectionId,
      graphqlId,
      noOfRequests,
      user,
      graphqlDto?.folderId,
    );
    const currentWorkspaceObject = new ObjectId(graphqlDto.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `GraphQL "${graphqlData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.GRAPHQL,
        workspaceId: graphqlDto.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Adds a request response to a collection or folder.
   * Ensures the user has the necessary permissions before performing the operation.
   * Produces an update message after saving the response.
   *
   * @param requestResponse - The request response data to add.
   * @returns - The newly created request response object.
   */
  async addRequestResponse(
    requestResponse: Partial<CollectionRequestResponseDto>,
    user: DecodedUserObject,
  ): Promise<CollectionItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      requestResponse.workspaceId,
      user._id,
    );
    await this.checkPermission(requestResponse.workspaceId, user._id);
    const uuid = uuidv4();
    const collection = await this.collectionReposistory.getCollection(
      requestResponse.collectionId,
    );
    const requestResponseObj: CollectionItem = {
      id: uuid,
      name: requestResponse.items.name,
      type: requestResponse.items.type,
      description: requestResponse.items.description,
      requestResponse: requestResponse.items.requestResponse,
      source: requestResponse.source ?? SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: user?.name,
      updatedBy: user?.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let updateMessage = ``;
    if (!requestResponse?.folderId) {
      await this.collectionReposistory.addRequestResponse(
        requestResponse.collectionId,
        requestResponse.requestId,
        requestResponseObj,
      );
      const currentWorkspaceObject = new ObjectId(requestResponse.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `Response "${requestResponse.items.name}" is saved under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.REQUEST_RESPONSE,
          workspaceId: requestResponse.workspaceId,
        }),
      });
      return requestResponseObj;
    } else {
      await this.collectionReposistory.addRequestResponseInFolder(
        requestResponse.collectionId,
        requestResponse.requestId,
        requestResponseObj,
        requestResponse?.folderId,
      );
      const currentWorkspaceObject = new ObjectId(requestResponse.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `Response "${requestResponse.items.name}" is saved under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.REQUEST_RESPONSE,
          workspaceId: requestResponse.workspaceId,
        }),
      });
      return requestResponseObj;
    }
  }

  /**
   * Updates an existing request response within a collection or folder.
   * Ensures the user has the necessary permissions before updating.
   * Produces an update message after modifying the response.
   *
   * @param responseId - The ID of the request response to update.
   * @param requestResponse - The updated request response data.
   * @returns - The updated request response object.
   */
  async updateRequestResponse(
    responseId: string,
    requestResponse: Partial<UpdateCollectionRequestResponseDto>,
    user: DecodedUserObject,
  ): Promise<Partial<UpdateCollectionRequestResponseDto>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      requestResponse.workspaceId,
      user._id,
    );
    await this.checkPermission(requestResponse.workspaceId, user._id);
    const collection = await this.collectionReposistory.updateRequestResponse(
      requestResponse.collectionId,
      responseId,
      requestResponse,
      user,
    );
    const collectionData = await this.collectionReposistory.getCollection(
      requestResponse.collectionId,
    );
    const requestResponseData = await this.findItemById(
      collectionData.items,
      responseId,
    );
    const currentWorkspaceObject = new ObjectId(requestResponse.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `Response "${
      requestResponseData?.name
    }" is updated under "${collectionData.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.REQUEST_RESPONSE,
        workspaceId: requestResponse.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Deletes a request response from a collection or folder.
   * Ensures the user has the necessary permissions before deletion.
   * Produces an update message after deletion.
   *
   * @param responseId - The ID of the request response to delete.
   * @param requestResponseDto - Data containing collection and request details.
   * @returns - The result of the delete operation.
   */
  async deleteRequestResponse(
    responseId: string,
    requestResponseDto: Partial<CollectionRequestResponseDto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      requestResponseDto.workspaceId,
      user._id,
    );
    await this.checkPermission(requestResponseDto.workspaceId, user._id);
    const collectionData = await this.collectionReposistory.getCollection(
      requestResponseDto.collectionId,
    );
    const requestResponseData = await this.findItemById(
      collectionData.items,
      responseId,
    );
    const collection = await this.collectionReposistory.deleteRequestResponse(
      requestResponseDto.collectionId,
      requestResponseDto.requestId,
      responseId,
      user,
      requestResponseDto?.folderId,
    );
    const currentWorkspaceObject = new ObjectId(requestResponseDto.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `Response "${requestResponseData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.REQUEST_RESPONSE,
        workspaceId: requestResponseDto.workspaceId,
      }),
    });
    return collection;
  }

  async addMockRequest(
    collectionId: string,
    request: Partial<CollectionRequestDto>,
    noOfRequests: number,
    user: DecodedUserObject,
    folderId?: string,
  ): Promise<CollectionItem> {
    const uuid = uuidv4();
    const collection =
      await this.collectionReposistory.getCollection(collectionId);
    const requestObj: CollectionItem = {
      id: uuid,
      name: request.items.name,
      type: request.items.type,
      description: request.items.description,
      mockRequest: { ...request.items.mockRequest },
      source: request.source ?? SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: user.name,
      updatedBy: user.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let updateMessage = ``;
    if (request.items.type === ItemTypeEnum.MOCK_REQUEST) {
      requestObj.request = request.items.request;
      await this.collectionReposistory.addMockRequest(
        collectionId,
        requestObj,
        noOfRequests,
      );
      const currentWorkspaceObject = new ObjectId(request.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New Mock API request "${request.items.name}" is saved in "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.MOCK_REQUEST,
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
          mockRequest: { ...request.items.items.mockRequest },
          source: SourceTypeEnum.USER,
          createdBy: user.name,
          updatedBy: user.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await this.collectionReposistory.addMockRequestInFolder(
        collectionId,
        requestObj,
        noOfRequests,
        folderId,
      );
      const currentWorkspaceObject = new ObjectId(request.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New Mock API request "${request.items.items.name}" is saved in "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.MOCK_REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
      return requestObj.items[0];
    }
  }

  async updateMockRequest(
    collectionId: string,
    requestId: string,
    request: Partial<CollectionRequestDto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    const collectionData =
      await this.collectionReposistory.getCollection(collectionId);
    const requestData = await this.findItemById(
      collectionData.items,
      requestId,
    );
    const collection = await this.collectionReposistory.updateMockRequest(
      collectionId,
      requestId,
      request,
      user,
    );
    const currentWorkspaceObject = new ObjectId(request.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );

    if (
      requestData?.name !== request?.items?.name &&
      requestData?.name &&
      request?.items?.name
    ) {
      const updateMessage = `"${requestData?.name}" API is renamed to "${request?.items?.name}" in "${collectionData.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.MOCK_REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
    }
    if (requestData?.description === "" && request?.items?.description) {
      const updateMessage = `API documentation is added for "${request.items.name}" API in "${collectionData.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.MOCK_REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
    } else if (
      requestData?.description !== request?.items?.description &&
      request?.items?.description
    ) {
      const updateMessage = `API documentation is updated for "${request.items.name}" API in "${collectionData.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.MOCK_REQUEST,
          workspaceId: request.workspaceId,
        }),
      });
    }
    return collection;
  }

  async deleteMockRequest(
    collectionId: string,
    requestId: string,
    noOfRequests: number,
    requestDto: Partial<CollectionRequestDto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    const collectionData =
      await this.collectionReposistory.getCollection(collectionId);
    const requestData = await this.findItemById(
      collectionData.items,
      requestId,
    );
    const collection = await this.collectionReposistory.deleteMockRequest(
      collectionId,
      requestId,
      noOfRequests,
      user,
      requestDto?.folderId,
    );
    const currentWorkspaceObject = new ObjectId(requestDto.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );

    const updateMessage = `Mock API request "${requestData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.MOCK_REQUEST,
        workspaceId: requestDto.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Adds a new AI Request to the collection.
   * This method handles AI Request and folderAI Request.
   *
   * @param aiRequest AI Request details to be added.
   * @returns AI Request item.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async addAiRequest(
    aiRequest: Partial<CollectionAiRequestDto>,
    user: DecodedUserObject,
  ): Promise<CollectionItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      aiRequest.workspaceId,
      user._id,
    );
    await this.checkPermission(aiRequest.workspaceId, user._id);
    const noOfRequests = await this.getNoOfRequest(aiRequest.collectionId);
    const uuid = uuidv4();
    const collection = await this.collectionReposistory.getCollection(
      aiRequest.collectionId,
    );
    const aiRequestObj: CollectionItem = {
      id: uuid,
      name: aiRequest.items.name,
      type: aiRequest.items.type,
      description: aiRequest.items.description,
      source: aiRequest.source ?? SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: user?.name,
      updatedBy: user?.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let updateMessage = ``;
    if (aiRequest.items.type === ItemTypeEnum.AI_REQUEST) {

      let encryptedAuthValue: string | undefined;
      if (aiRequest.items.aiRequest?.auth?.apiKey?.authValue) {
          encryptedAuthValue = this.encryptionService.encrypt(
            aiRequest.items.aiRequest.auth.apiKey.authValue as string,
          );
          aiRequestObj.aiRequest = {
          ...aiRequest.items.aiRequest,
          auth: {
            ...aiRequest.items.aiRequest.auth,
            apiKey: {
              ...aiRequest.items.aiRequest.auth.apiKey,
              authValue: encryptedAuthValue,
            },
          },
        };
      }
      else {
        aiRequestObj.aiRequest = aiRequest.items.aiRequest;
      }

      await this.collectionReposistory.addAiRequest(
        aiRequest.collectionId,
        aiRequestObj,
        noOfRequests,
      );
      const currentWorkspaceObject = new ObjectId(aiRequest.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New AI request "${aiRequest.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.AI_REQUEST,
          workspaceId: aiRequest.workspaceId,
        }),
      });

      if (aiRequest.items.aiRequest?.auth?.apiKey?.authValue) {
          return {
        ...aiRequestObj,
        aiRequest: {
          ...aiRequestObj.aiRequest,
          auth: {
            ...aiRequestObj.aiRequest.auth,
            apiKey: {
              ...aiRequestObj.aiRequest.auth.apiKey,
              authValue: this.encryptionService.decrypt(
                aiRequestObj.aiRequest.auth.apiKey.authValue as string,
              ),
            },
          },
        },
      };
      }
      else {
        return aiRequestObj;
      }


    } else {
      if (aiRequest.items.items.aiRequest?.auth?.apiKey?.authValue) {
        const encryptedAuthValue = this.encryptionService.encrypt(
        aiRequest.items.items.aiRequest.auth.apiKey.authValue as string,
      );
      aiRequestObj.items = [
        {
          id: uuidv4(),
          name: aiRequest.items.items.name,
          type: aiRequest.items.items.type,
          description: aiRequest.items.items.description,
          aiRequest: {
            ...aiRequest.items.items.aiRequest,
            auth: {
              ...aiRequest.items.items.aiRequest.auth,
              apiKey: {
                ...aiRequest.items.items.aiRequest.auth.apiKey,
                authValue: encryptedAuthValue,
              },
            },
          },
          source: SourceTypeEnum.USER,
          createdBy: user?.name,
          updatedBy: user?.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }
    else {
      aiRequestObj.items = [
        {
          id: uuidv4(),
          name: aiRequest.items.items.name,
          type: aiRequest.items.items.type,
          description: aiRequest.items.items.description,
          aiRequest: { ...aiRequest.items.items.aiRequest },
          source: SourceTypeEnum.USER,
          createdBy: user?.name,
          updatedBy: user?.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }
      await this.collectionReposistory.addAiRequestInFolder(
        aiRequest.collectionId,
        aiRequestObj,
        noOfRequests,
        aiRequest?.folderId,
      );
      const currentWorkspaceObject = new ObjectId(aiRequest.workspaceId);
      const updateWorkspaceData: Partial<Workspace> = {
        updatedAt: new Date(),
      };
      await this.workspaceReposistory.updateWorkspaceById(
        currentWorkspaceObject,
        updateWorkspaceData,
      );
      updateMessage = `New AI request "${aiRequest.items.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.AI_REQUEST,
          workspaceId: aiRequest.workspaceId,
        }),
      });
      if (aiRequest.items.aiRequest?.auth?.apiKey?.authValue) {
        // Decrypt before returning
        const decryptedItem = {
          ...aiRequestObj.items[0],
          aiRequest: {
            ...aiRequestObj.items[0].aiRequest,
            auth: {
              ...aiRequestObj.items[0].aiRequest.auth,
              apiKey: {
                ...aiRequestObj.items[0].aiRequest.auth.apiKey,
                authValue: this.encryptionService.decrypt(
                  aiRequestObj.items[0].aiRequest.auth.apiKey.authValue as string,
                ),
              },
            },
          },
        };
        return decryptedItem;
      }
      else {
        return aiRequestObj.items[0];
      }
    }
  }

  /**
   * Updates an existing AI Request in the collection.
   *
   * @param aiRequestId - The ID of the AI Request to be updated.
   * @param aiRequest - The updated AI Request details.
   * @returns The updated AI Request item.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async updateAiRequest(
    aiRequestId: string,
    aiRequest: Partial<CollectionAiRequestDto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      aiRequest.workspaceId,
      user._id,
    );
    await this.checkPermission(aiRequest.workspaceId, user._id);
    // Encrypt only apiKey.authValue
    if (aiRequest.items.type === ItemTypeEnum.AI_REQUEST) {
      let encryptedAuthValue: string | undefined;
      if (aiRequest.items.aiRequest?.auth?.apiKey?.authValue) {
        const encryptedAuthValue = this.encryptionService.encrypt(
          aiRequest.items.aiRequest.auth.apiKey.authValue as string,
        );

        aiRequest.items.aiRequest = {
          ...aiRequest.items.aiRequest,
          auth: {
            ...aiRequest.items.aiRequest.auth,
            apiKey: {
              ...aiRequest.items.aiRequest.auth.apiKey,
              authValue: encryptedAuthValue,
            },
          },
        };
      }
    }
    else {
      if (aiRequest.items.items.aiRequest?.auth?.apiKey?.authValue) {
        const encryptedAuthValue = this.encryptionService.encrypt(
          aiRequest.items.items.aiRequest.auth.apiKey.authValue as string,
        );

        aiRequest.items.items.aiRequest = {
          ...aiRequest.items.items.aiRequest,
          auth: {
            ...aiRequest.items.items.aiRequest.auth,
            apiKey: {
              ...aiRequest.items.items.aiRequest.auth.apiKey,
              authValue: encryptedAuthValue,
            },
          },
        };
      }
    }
    const collection = await this.collectionReposistory.updateAiRequest(
      aiRequest.collectionId,
      aiRequestId,
      aiRequest,
      user,
    );
    const collectionData = await this.collectionReposistory.getCollection(
      aiRequest.collectionId,
    );

    console.log("Collection: ", collection)
    // Decrypt authValue in flat structure
    if (collection?.aiRequest?.auth?.apiKey?.authValue) {
      collection.aiRequest.auth.apiKey.authValue = this.encryptionService.decrypt(
        String(collection.aiRequest.auth.apiKey.authValue),
      );
    }


    const currentWorkspaceObject = new ObjectId(aiRequest.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `AI Request "${
      aiRequest?.items?.name ?? aiRequest?.items?.items?.name
    }" is updated under "${collectionData.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.AI_REQUEST,
        workspaceId: aiRequest.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Deletes an existing AI Request from the collection.
   *
   * @param aiRequestId - The ID of the AI Request to be deleted.
   * @param aiRequestDto - The AI Request details including collection ID and folder ID (if applicable).
   * @returns The result of the update operation.
   * @throws UnauthorizedException if the user does not have the required permissions.
   */
  async deleteAiRequest(
    aiRequestId: string,
    aiRequestDto: Partial<CollectionAiRequestDto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      aiRequestDto.workspaceId,
      user._id,
    );
    await this.checkPermission(aiRequestDto.workspaceId, user._id);
    const noOfRequests = await this.getNoOfRequest(aiRequestDto.collectionId);
    const collectionData = await this.collectionReposistory.getCollection(
      aiRequestDto.collectionId,
    );
    const aiRequestData = await this.findItemById(
      collectionData.items,
      aiRequestId,
    );
    const collection = await this.collectionReposistory.deleteAiRequest(
      aiRequestDto.collectionId,
      aiRequestId,
      noOfRequests,
      user,
      aiRequestDto?.folderId,
    );
    const currentWorkspaceObject = new ObjectId(aiRequestDto.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `AI Request "${aiRequestData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.AI_REQUEST,
        workspaceId: aiRequestDto.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Adds a new mock request response to a collection or folder.
   * Ensures the user has the necessary permissions before performing the operation.
   * Produces an update message after saving the response.
   *
   * @param mockRequestResponse - The mock request response data to add.
   * @returns - The newly created mock request response object.
   */
  async addMockRequestResponse(
    mockRequestResponse: Partial<CollectionMockRequestResponseDto>,
    user: DecodedUserObject,
  ): Promise<CollectionItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      mockRequestResponse.workspaceId,
      user._id,
    );
    await this.checkPermission(mockRequestResponse.workspaceId, user._id);
    const uuid = uuidv4();
    const collection = await this.collectionReposistory.getCollection(
      mockRequestResponse.collectionId,
    );
    const mockRequestResponseObj: CollectionItem = {
      id: uuid,
      name: mockRequestResponse.items.name,
      type: mockRequestResponse.items.type,
      description: mockRequestResponse.items.description,
      mockRequestResponse: mockRequestResponse.items.mockRequestResponse,
      source: mockRequestResponse.source ?? SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: user?.name,
      updatedBy: user?.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let updateMessage = ``;
    const currentWorkspaceObject = new ObjectId(
      mockRequestResponse.workspaceId,
    );
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    if (!mockRequestResponse?.folderId) {
      await this.collectionReposistory.addMockRequestResponse(
        mockRequestResponse.collectionId,
        mockRequestResponse.mockRequestId,
        mockRequestResponseObj,
      );
      updateMessage = `Mock response "${mockRequestResponse.items.name}" is saved under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.MOCK_REQUEST_RESPONSE,
          workspaceId: mockRequestResponse.workspaceId,
        }),
      });
      return mockRequestResponseObj;
    } else {
      await this.collectionReposistory.addMockRequestResponseInFolder(
        mockRequestResponse.collectionId,
        mockRequestResponse.mockRequestId,
        mockRequestResponseObj,
        mockRequestResponse?.folderId,
      );
      updateMessage = `Mock response "${mockRequestResponse.items.name}" is saved under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
          type: UpdatesType.MOCK_REQUEST_RESPONSE,
          workspaceId: mockRequestResponse.workspaceId,
        }),
      });
      return mockRequestResponseObj;
    }
  }

  /**
   * Updates an existing mock request response within a collection or folder.
   * Ensures the user has the necessary permissions before updating.
   * Produces an update message after modifying the response.
   *
   * @param responseId - The ID of the mock request response to update.
   * @param mockRequestResponse - The updated mock request response data.
   * @returns - The updated mock request response object.
   */
  async updateMockRequestResponse(
    responseId: string,
    mockRequestResponse: Partial<UpdateCollectionMockRequestResponseDto>,
    user: DecodedUserObject,
  ): Promise<Partial<UpdateCollectionMockRequestResponseDto>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      mockRequestResponse.workspaceId,
      user._id,
    );
    await this.checkPermission(mockRequestResponse.workspaceId, user._id);
    const collection =
      await this.collectionReposistory.updateMockRequestResponse(
        mockRequestResponse.collectionId,
        responseId,
        mockRequestResponse,
        user,
      );
    const collectionData = await this.collectionReposistory.getCollection(
      mockRequestResponse.collectionId,
    );
    const mockRequestResponseData = await this.findItemById(
      collectionData.items,
      responseId,
    );
    const currentWorkspaceObject = new ObjectId(
      mockRequestResponse.workspaceId,
    );
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `Mock response "${
      mockRequestResponseData?.name
    }" is updated under "${collectionData.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.MOCK_REQUEST_RESPONSE,
        workspaceId: mockRequestResponse.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Deletes a mock request response from a collection or folder.
   * Ensures the user has the necessary permissions before deletion.
   * Produces an update message after deletion.
   *
   * @param responseId - The ID of the mock request response to delete.
   * @param mockRequestResponseDto - Data containing collection and mock request details.
   * @returns - The result of the delete operation.
   */
  async deleteMockRequestResponse(
    responseId: string,
    mockRequestResponseDto: Partial<CollectionMockRequestResponseDto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      mockRequestResponseDto.workspaceId,
      user._id,
    );
    await this.checkPermission(mockRequestResponseDto.workspaceId, user._id);
    const collectionData = await this.collectionReposistory.getCollection(
      mockRequestResponseDto.collectionId,
    );
    const mockRequestResponseData = await this.findItemById(
      collectionData.items,
      responseId,
    );
    const collection =
      await this.collectionReposistory.deleteMockRequestResponse(
        mockRequestResponseDto.collectionId,
        mockRequestResponseDto.mockRequestId,
        responseId,
        user,
        mockRequestResponseDto?.folderId,
      );
    const currentWorkspaceObject = new ObjectId(
      mockRequestResponseDto.workspaceId,
    );
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `Mock response "${mockRequestResponseData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.MOCK_REQUEST_RESPONSE,
        workspaceId: mockRequestResponseDto.workspaceId,
      }),
    });
    return collection;
  }

  /**
   * Updates mock response ratios for multiple responses within a mock request.
   * Ensures the user has the necessary permissions before updating.
   * Produces an update message after modifying the ratios.
   *
   * @param updateRatioDto - The data containing mock response ratios to update
   * @param user - The user performing the update
   * @returns - The result of the update operation
   */
  async updateMockResponseRatios(
    updateRatioDto: Partial<UpdateMockResponseRatioDto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      updateRatioDto.workspaceId,
      user._id,
    );
    await this.checkPermission(updateRatioDto.workspaceId, user._id);

    const result = await this.collectionReposistory.updateMockResponseRatios(
      updateRatioDto.collectionId,
      updateRatioDto.mockRequestId,
      updateRatioDto.mockResponseRatios,
      user,
      updateRatioDto.folderId,
    );
    const currentWorkspaceObject = new ObjectId(updateRatioDto.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    return result;
  }

  /**
   * Generates URL, body, and query parameter variables from a collection's request data.
   *
   * This method:
   * 1. Retrieves the collection by its ID.
   * 2. Extracts URLs, request bodies, and query parameters from the collection items.
   * 3. Identifies recurring patterns/values to generate reusable variable placeholders.
   * @returns
   * A promise that resolves to an object containing generated variables
   * grouped by type (`url`, `body`, and `query`).
  */
  async generateVariables(
    collectionId: string,
    workspaceId: string,
    userId: DecodedUserObject
  ): Promise<GeneratedVariablesDto> {
    const collection = await this.collectionReposistory.getCollection(collectionId);

    if (!collection) {
      throw new BadRequestException("Collection Not Found");
    }

    // Extract data from collection
    const { urls, bodies, queryParams } = this.extractFromItems(collection.items);

    // Generate variables for each type
    const urlVariables = this.generateUrlVariables(urls);
    const bodyVariables = this.generateBodyVariables(bodies);
    const queryVariables = this.generateQueryVariables(queryParams);

    return {
      url: urlVariables,
      body: bodyVariables,
      query: queryVariables
    };
  }

  /**
   * Removes invalid or unwanted key-value entries from the given array.
   * This method:
   * - Ensures the input is an array.
   * - Trims `key` and `value` fields.
   * - Excludes entries where either `key` or `value` is missing or empty.
   * - Filters out headers/keys named "user-agent" or "accept-encoding" (case-insensitive).
   * @returns A new array containing only valid and allowed entries.
  */
  private clean(arr: any[] = []): any[] {
    return Array.isArray(arr)
      ? arr.filter(entry => {
          const key = entry?.key?.trim().toLowerCase();
          const value = entry?.value?.trim();
          return key && value && key !== 'user-agent' && key !== 'accept-encoding';
        })
      : [];
  }

  /**
   * Recursively traverses a collection of items and extracts:
   * - All request URLs
   * - Request bodies (from multiple protocols/types)
   * - Query parameters
   *
   * Supported `type` values:
   * - `REQUEST` / `AI_REQUEST` → Extracts from `request` or `aiRequest`
   * - `WEBSOCKET` → Extracts from `websocket`
   * - `SOCKETIO` → Extracts from `socketio`
   * - `GRAPHQL` → Extracts from `graphql`
   * - `FOLDER` → Recursively processes nested `items`
   *
   * Notes:
   * - Calls `this.clean()` to remove empty/invalid key-value pairs in
   *   body form data, URL-encoded data, and query parameters.
   * - Only bodies with actual content are added to the `bodies` array.
   * - Query parameters are collected as groups (arrays of key-value pairs).
   * @returns 
   *   An object containing:
   *   - `urls`: Array of all extracted URLs
   *   - `bodies`: Array of body objects containing request payload data
   *   - `queryParams`: Array of arrays, each containing cleaned query parameter objects
  */
  private extractFromItems(items: any[]) {
    const urls: string[] = [];
    const bodies: any[] = [];
    const queryParams: any[] = [];

    const traverse = (items: any[]) => {
      for (const item of items) {
        const { type } = item;
        let req = null;

        switch (type) {
          case UpdatesType.REQUEST:
          case UpdatesType.AI_REQUEST:
            req = item.request || item.aiRequest;
            if (req?.url) urls.push(req.url);

            const urlencoded = this.clean(req.body?.urlencoded);
            const formdataText = this.clean(req.body?.formdata?.text);
            const formdataFile = this.clean(req.body?.formdata?.file);
            const raw = req.body?.raw || '';

            const body: any = { raw };

            if (urlencoded.length > 0) body.urlencoded = urlencoded;
            if (formdataText.length > 0 || formdataFile.length > 0) {
              body.formdata = {};
              if (formdataText.length > 0) body.formdata.text = formdataText;
              if (formdataFile.length > 0) body.formdata.file = formdataFile;
            }

            const hasBodyContent =
              raw.trim() !== '' ||
              (body.urlencoded?.length > 0) ||
              (body.formdata?.text?.length > 0 || body.formdata?.file?.length > 0);

            if (hasBodyContent) {
              bodies.push(body);
            }

            const cleanedQueryParams = this.clean(req.queryParams);
            if (cleanedQueryParams.length > 0) {
              queryParams.push(cleanedQueryParams);
            }
            break;

          case UpdatesType.WEBSOCKET:
            req = item.websocket;
            if (req?.url) urls.push(req.url);

            const wsBody: any = {};
            if (req.message?.trim()) wsBody.message = req.message;
            if (Object.keys(wsBody).length > 0) bodies.push(wsBody);

            const cleanedWsQuery = this.clean(req.queryParams);
            if (cleanedWsQuery.length > 0) queryParams.push(cleanedWsQuery);
            break;

          case UpdatesType.SOCKETIO:
            req = item.socketio;
            if (req?.url) urls.push(req.url);

            const socketBody: any = {};
            if (req.message?.trim()) socketBody.message = req.message;
            if (req.eventName?.trim()) socketBody.event = req.eventName;
            if (Object.keys(socketBody).length > 0) bodies.push(socketBody);

            const cleanedSocketQuery = this.clean(req.queryParams);
            if (cleanedSocketQuery.length > 0) queryParams.push(cleanedSocketQuery);
            break;

          case UpdatesType.GRAPHQL:
            req = item.graphql;
            if (req?.url) urls.push(req.url);

            const gqlBody: any = {};
            if (req.query?.trim()) gqlBody.query = req.query;
            if (req.mutation?.trim()) gqlBody.mutation = req.mutation;
            if (req.variables?.trim()) gqlBody.variables = req.variables;

            if (Object.keys(gqlBody).length > 0) bodies.push(gqlBody);
            break;

          case UpdatesType.FOLDER:
            if (item.items) traverse(item.items);
            break;

          default:
            break;
        }
      }
    };

    traverse(items);
    return { urls, bodies, queryParams };
  }

  /**
   * Analyzes a list of URLs to identify recurring patterns and replace them with variable placeholders.
   *
   * The algorithm:
   * 1. Detects and preserves any existing variables in the format `{{varName}}` or `{varName}`.
   * 2. Removes preserved variables from the URLs to avoid re-replacing them.
   * 3. Splits each cleaned URL into meaningful path/query parts.
   * 4. Generates candidate substrings (1–4 consecutive parts) and counts their occurrences across URLs.
   * 5. Filters substrings by:
   *    - Minimum length (≥ 8 characters)
   *    - Frequency threshold (adaptive based on URL count)
   *    - Exclusion of purely numeric or percent-encoded values
   * 6. Selects the top non-overlapping substrings (up to 8) based on occurrence count and length.
   * 7. Assigns them sequential variable names in the format `{{url_var1}}`, `{{url_var2}}`, etc.
   *
   * Example:
   * ```ts
   * generateUrlVariables([
   *   "https://api.example.com/v1/users/123/details",
   *   "https://api.example.com/v1/users/456/details"
   * ]);
   * // Might return:
   * // { "{{url_var1}}": "api.example.com/v1/users" }
   * ```
   * @returns
   *   An object mapping generated variable names (e.g., `{{url_var1}}`) to their corresponding substring values.
  */
  private generateUrlVariables(urls: string[]): Record<string, string> {
    if (urls.length === 0) return {};

    // Identify existing variables
    const existingVariablePattern = /\{\{?[^}]+\}?\}/g;
    const preservedVariables = new Set<string>();
    
    urls.forEach(url => {
      const matches = url.match(existingVariablePattern);
      if (matches) {
        matches.forEach(match => preservedVariables.add(match));
      }
    });

    // Find common substrings
    const substringFrequency = new Map<string, { count: number; urls: number[] }>();
    
    urls.forEach((url, urlIndex) => {
      // Clean URL by removing existing variables
      let cleanUrl = url;
      Array.from(preservedVariables).forEach((variable, index) => {
        if (url.includes(variable)) {
          const placeholder = `__VAR_${index}__`;
          cleanUrl = cleanUrl.replace(variable, placeholder);
        }
      });
      
      // Split URL into meaningful parts
      const parts = cleanUrl.split(/[\/\?&=]/).filter(part => part.length > 0);
      
      // Generate substrings
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j <= Math.min(parts.length, i + 4); j++) {
          const substring = parts.slice(i, j).join('/');
          
          // Skip invalid substrings
          if (substring.includes('__VAR_') || 
              substring.length < 3 || 
              /^\d+$/.test(substring) ||
              substring.includes('%') || 
              substring.includes('=')) continue;
          
          // Find actual substring in original URL
          const urlParts = url.split('/');
          let fullSubstring = '';
          
          for (let k = 0; k < urlParts.length; k++) {
            for (let l = k + 1; l <= urlParts.length; l++) {
              const testSubstring = urlParts.slice(k, l).join('/');
              if (testSubstring.includes(substring) && 
                  !Array.from(preservedVariables).some(v => testSubstring.includes(v)) &&
                  testSubstring.length >= 8) {
                fullSubstring = testSubstring;
                break;
              }
            }
            if (fullSubstring) break;
          }
          
          if (fullSubstring && url.includes(fullSubstring)) {
            if (!substringFrequency.has(fullSubstring)) {
              substringFrequency.set(fullSubstring, { count: 0, urls: [] });
            }
            
            const entry = substringFrequency.get(fullSubstring)!;
            if (!entry.urls.includes(urlIndex)) {
              entry.count++;
              entry.urls.push(urlIndex);
            }
          }
        }
      }
    });

    // Filter and rank candidates
    const threshold = this.getAdaptiveThreshold(urls.length);
    
    const candidates = Array.from(substringFrequency.entries())
      .filter(([substring, data]) => {
        return data.count >= threshold && 
               substring.length >= 8 && 
               !Array.from(preservedVariables).some(v => substring.includes(v));
      })
      .map(([substring, data]) => ({
        substring,
        count: data.count,
        length: substring.length,
        priority: data.count * 1000 + substring.length
      }))
      .sort((a, b) => b.priority - a.priority);

    // Select non-overlapping candidates
    const selectedCandidates: typeof candidates = [];
    
    for (const candidate of candidates) {
      let shouldInclude = true;
      
      for (const selected of selectedCandidates) {
        if (candidate.substring.includes(selected.substring) || 
            selected.substring.includes(candidate.substring)) {
          shouldInclude = false;
          break;
        }
      }
      
      if (shouldInclude) {
        selectedCandidates.push(candidate);
      }
      
      if (selectedCandidates.length >= 8) break;
    }

    // Generate variable mappings
    const variables: Record<string, string> = {};
    selectedCandidates.forEach((candidate, index) => {
      variables[`{{url_var${index + 1}}}`] = candidate.substring;
    });

    return variables;
  }

  /**
   * Analyzes an array of request bodies to detect frequently repeated values
   * and generates variable placeholders for them.
   *
   * The algorithm:
   * 1. Iterates through each body object and inspects:
   *    - `urlencoded` fields
   *    - `formdata.text` fields
   *    - Raw JSON content (parsed and traversed for key-value pairs)
   *    - Special string fields like `message`, `event`, `query`, `mutation`, `variables`
   * 2. For each key/value pair found, counts how often each value appears per key.
   * 3. Uses an adaptive threshold (via `getAdaptiveThreshold`) to determine
   *    which values occur often enough to be replaced by variables.
   * 4. Generates sequential variable names in the format `{{<key>_varN}}`,
   *    mapping them to the original repeated values.
   *
   * Example:
   * ```ts
   * generateBodyVariables([
   *   { urlencoded: [{ key: "userId", value: "123", checked: true }] },
   *   { urlencoded: [{ key: "userId", value: "123", checked: true }] },
   *   { urlencoded: [{ key: "userId", value: "456", checked: true }] }
   * ]);
   * // Might return:
   * // { "{{userId_var1}}": "123" }
   * ```
   * @returns
   *   An object mapping generated variable names (e.g., `{{key_var1}}`) to their corresponding values.
  */
  private generateBodyVariables(bodies: any[]): Record<string, string> {
    if (bodies.length === 0) return {};

    const valueFrequencyByKey = new Map<string, Map<string, number>>();
    const valueCountByKey: Record<string, number> = {};

    const extractKeyValuePairs = (obj: any, parentKey = ''): Array<[string, string]> => {
      const pairs: Array<[string, string]> = [];

      if (typeof obj === 'string') {
        if (obj.trim()) pairs.push([parentKey || 'body', obj.trim()]);
      } else if (Array.isArray(obj)) {
        obj.forEach((item) => pairs.push(...extractKeyValuePairs(item, parentKey)));
      } else if (typeof obj === 'object' && obj !== null) {
        for (const [k, v] of Object.entries(obj)) {
          pairs.push(...extractKeyValuePairs(v, k));
        }
      }

      return pairs;
    };

    // Parse all values with keys
    for (const body of bodies) {
      // Process urlencoded
      if (body.urlencoded) {
        for (const item of body.urlencoded) {
          if (item.checked !== false && item.value?.trim()) {
            const key = item.key.trim();
            const value = item.value.trim();
            this.addToFrequencyMap(key, value, valueFrequencyByKey, valueCountByKey);
          }
        }
      }

      // Process formdata
      if (body.formdata?.text) {
        for (const item of body.formdata.text) {
          if (item.checked !== false && item.value?.trim()) {
            const key = item.key.trim();
            const value = item.value.trim();
            this.addToFrequencyMap(key, value, valueFrequencyByKey, valueCountByKey);
          }
        }
      }

      // Process raw JSON
      if (body.raw?.trim()) {
        try {
          const parsed = JSON.parse(body.raw);
          const keyVals = extractKeyValuePairs(parsed);
          for (const [key, value] of keyVals) {
            this.addToFrequencyMap(key, value, valueFrequencyByKey, valueCountByKey);
          }
        } catch {
          // Ignore parsing errors
        }
      }

      // Process other body types (websocket, socketio, graphql)
      ['message', 'event', 'query', 'mutation', 'variables'].forEach(field => {
        if (body[field]?.trim()) {
          this.addToFrequencyMap(field, body[field].trim(), valueFrequencyByKey, valueCountByKey);
        }
      });
    }

    // Generate variables
    const result: Record<string, string> = {};
    const keyVarCounters: Record<string, number> = {};

    for (const [key, valMap] of valueFrequencyByKey.entries()) {
      const threshold = this.getAdaptiveThreshold(valueCountByKey[key]);
      keyVarCounters[key] = keyVarCounters[key] || 1;

      for (const [value, count] of valMap.entries()) {
        if (count >= threshold) {
          const cleanKey = key || 'body';
          const varName = `{{${cleanKey}_var${keyVarCounters[key]++}}}`;
          result[varName] = value;
        }
      }
    }

    return result;
  }

  /**
   * Generates variable mappings for frequently occurring query parameter values.
   *
   * This method:
   * - Iterates over grouped query parameters (arrays of `{ key, value, checked }` objects).
   * - Ignores unchecked parameters (`checked === false`) or empty values.
   * - Tracks the frequency of each value for its corresponding key.
   * - Uses an adaptive threshold (`getAdaptiveThreshold`) to decide if a value
   *   occurs often enough to be replaced with a variable.
   * - Generates variable names in the format `{{<key>_varN}}` for repeated values.
   * @returns
   *   An object mapping generated variable names to their original string values.
  */
  private generateQueryVariables(paramGroups: Array<Array<{ key: string; value: string; checked: boolean }>>): Record<string, string> {
    if (paramGroups.length === 0) return {};

    const keyValueFrequency = new Map<string, Map<string, number>>();
    const keyValueCount: Record<string, number> = {};

    // Count frequencies per key
    for (const group of paramGroups) {
      for (const param of group) {
        if (param.checked !== false && param.value?.trim()) {
          const key = param.key;
          const value = param.value.trim();
          this.addToFrequencyMap(key, value, keyValueFrequency, keyValueCount);
        }
      }
    }

    // Generate variable names per key
    const result: Record<string, string> = {};
    const keyCounters: Record<string, number> = {};

    for (const [key, valMap] of keyValueFrequency.entries()) {
      const threshold = this.getAdaptiveThreshold(keyValueCount[key]);
      keyCounters[key] = keyCounters[key] || 1;

      for (const [value, count] of valMap.entries()) {
        if (count >= threshold) {
          const varName = `{{${key}_var${keyCounters[key]++}}}`;
          result[varName] = value;
        }
      }
    }

    return result;
  }

  /**
   * Adds a key–value occurrence to a nested frequency map and updates its count.
   *
   * Maintains two data structures:
   * - `frequencyMap`: Tracks how many times each value occurs for each key.
   * - `countMap`: Tracks the total number of values recorded for each key.
   *
   * If the key does not exist in `frequencyMap`, it is initialized with
   * an empty value map and a zero count in `countMap`.
  */
  private addToFrequencyMap(
    key: string, 
    value: string, 
    frequencyMap: Map<string, Map<string, number>>, 
    countMap: Record<string, number>
  ) {
    if (!frequencyMap.has(key)) {
      frequencyMap.set(key, new Map());
      countMap[key] = 0;
    }

    const valMap = frequencyMap.get(key)!;
    valMap.set(value, (valMap.get(value) || 0) + 1);
    countMap[key]++;
  }

  /**
   * Determines the minimum frequency threshold based on the total occurrence count.
   *
   * Used to decide whether a value is common enough to be extracted as a variable.
   * - For small datasets (≤ 10 total occurrences), a lower threshold is applied.
   * - For larger datasets (> 10 total occurrences), a higher threshold is applied.
   * @returns
   *   The minimum frequency threshold to qualify as significant.
  */
  private getAdaptiveThreshold(count: number): number {
    return count <= 10 ? 3 : 5;
  }
}