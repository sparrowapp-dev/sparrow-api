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
  CollectionGraphQLDto,
  CollectionRequestDto,
  CollectionRequestItem,
  CollectionRequestResponseDto,
  CollectionSocketIODto,
  CollectionWebSocketDto,
  DeleteFolderDto,
  FolderDto,
  UpdateCollectionRequestResponseDto,
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
    const collection =
      await this.collectionReposistory.getCollection(collectionId);
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
    );
    if (request?.currentBranch) {
      await this.branchRepository.updateRequestInBranch(
        collectionId,
        request.currentBranch,
        requestId,
        request,
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
    } else if (
      requestData?.description !== request?.items?.description &&
      request?.items?.description
    ) {
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
  ): Promise<CollectionItem> {
    const user = await this.contextService.get("user");
    await this.workspaceService.IsWorkspaceAdminOrEditor(websocket.workspaceId);
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
      updateMessage = `New WebSocket "${websocket.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
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
      updateMessage = `New WebSocket "${websocket.items.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
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
  ): Promise<CollectionRequestItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(websocket.workspaceId);
    const user = await this.contextService.get("user");
    await this.checkPermission(websocket.workspaceId, user._id);
    const collection = await this.collectionReposistory.updateWebSocket(
      websocket.collectionId,
      websocketId,
      websocket,
    );
    const collectionData = await this.collectionReposistory.getCollection(
      websocket.collectionId,
    );
    const updateMessage = `WebSocket "${
      websocket?.items?.name ?? websocket?.items?.items?.name
    }" is updated under "${collectionData.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
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
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      websocketDto.workspaceId,
    );
    const user = await this.contextService.get("user");
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
      websocketDto?.folderId,
    );
    const updateMessage = `WebSocket "${websocketData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
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
  ): Promise<CollectionItem> {
    const user = await this.contextService.get("user");
    await this.workspaceService.IsWorkspaceAdminOrEditor(socketio.workspaceId);
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
      updateMessage = `New Socket.IO "${socketio.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
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
      updateMessage = `New Socket.IO "${socketio.items.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
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
  ): Promise<CollectionRequestItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(socketio.workspaceId);
    const user = await this.contextService.get("user");
    await this.checkPermission(socketio.workspaceId, user._id);
    const collection = await this.collectionReposistory.updateSocketIO(
      socketio.collectionId,
      socketioId,
      socketio,
    );
    const collectionData = await this.collectionReposistory.getCollection(
      socketio.collectionId,
    );
    const updateMessage = `Socket.IO "${
      socketio?.items?.name ?? socketio?.items?.items?.name
    }" is updated under "${collectionData.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
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
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      socketioDto.workspaceId,
    );
    const user = await this.contextService.get("user");
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
      socketioDto?.folderId,
    );
    const updateMessage = `Socket.IO "${socketioData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
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
  ): Promise<CollectionItem> {
    const user = await this.contextService.get("user");
    await this.workspaceService.IsWorkspaceAdminOrEditor(graphql.workspaceId);
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
      updateMessage = `New GraphQL "${graphql.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
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
      updateMessage = `New GraphQL "${graphql.items.items.name}" is created under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
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
  ): Promise<CollectionRequestItem> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(graphql.workspaceId);
    const user = await this.contextService.get("user");
    await this.checkPermission(graphql.workspaceId, user._id);
    const collection = await this.collectionReposistory.updateGraphQL(
      graphql.collectionId,
      graphqlId,
      graphql,
    );
    const collectionData = await this.collectionReposistory.getCollection(
      graphql.collectionId,
    );
    const updateMessage = `GraphQL "${
      graphql?.items?.name ?? graphql?.items?.items?.name
    }" is updated under "${collectionData.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
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
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      graphqlDto.workspaceId,
    );
    const user = await this.contextService.get("user");
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
      graphqlDto?.folderId,
    );
    const updateMessage = `GraphQL "${graphqlData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
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
  ): Promise<CollectionItem> {
    const user = await this.contextService.get("user");
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      requestResponse.workspaceId,
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
      updateMessage = `Response "${requestResponse.items.name}" is saved under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
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
      updateMessage = `Response "${requestResponse.items.name}" is saved under "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
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
  ): Promise<Partial<UpdateCollectionRequestResponseDto>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      requestResponse.workspaceId,
    );
    const user = await this.contextService.get("user");
    await this.checkPermission(requestResponse.workspaceId, user._id);
    const collection = await this.collectionReposistory.updateRequestResponse(
      requestResponse.collectionId,
      responseId,
      requestResponse,
    );
    const collectionData = await this.collectionReposistory.getCollection(
      requestResponse.collectionId,
    );
    const requestResponseData = await this.findItemById(
      collectionData.items,
      responseId,
    );
    const updateMessage = `Response "${
      requestResponseData?.name
    }" is updated under "${collectionData.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
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
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(
      requestResponseDto.workspaceId,
    );
    const user = await this.contextService.get("user");
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
      requestResponseDto?.folderId,
    );
    const updateMessage = `Response "${requestResponseData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
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
    userName: string,
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
      createdBy: userName,
      updatedBy: userName,
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
      updateMessage = `New Mock API request "${request.items.name}" is saved in "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
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
          createdBy: userName,
          updatedBy: userName,
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

      updateMessage = `New Mock API request "${request.items.items.name}" is saved in "${collection.name}" collection`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
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
      requestDto?.folderId,
    );

    const updateMessage = `Mock API request "${requestData?.name}" is deleted from "${collectionData?.name}" collection`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        type: UpdatesType.MOCK_REQUEST,
        workspaceId: requestDto.workspaceId,
      }),
    });
    return collection;
  }
}
