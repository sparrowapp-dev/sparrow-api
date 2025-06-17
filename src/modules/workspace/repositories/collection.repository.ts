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

import {
  CollectionBranch,
  Collection,
  CollectionItem,
  ItemTypeEnum,
  CollectionTypeEnum,
} from "@src/modules/common/models/collection.model";
import {
  CollectionGraphQLDto,
  CollectionRequestDto,
  CollectionRequestItem,
  CollectionSocketIODto,
  CollectionWebSocketDto,
  UpdateCollectionMockRequestResponseDto,
  UpdateCollectionRequestResponseDto,
} from "../payloads/collectionRequest.payload";
import { ErrorMessages } from "@src/modules/common/enum/error-messages.enum";
import { Workspace } from "@src/modules/common/models/workspace.model";
import { DecodedUserObject } from "@src/types/fastify";
@Injectable()
export class CollectionRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}
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
    updateCollectionDto: Partial<UpdateCollectionDto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult> {
    const collectionId = new ObjectId(id);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: {
        id: user._id.toString(),
        name: user.name,
      },
    };
    const data = await this.db
      .collection(Collections.COLLECTION)
      .updateOne(
        { _id: collectionId },
        { $set: { ...updateCollectionDto, ...defaultParams } },
      );
    return data;
  }

  async updateBranchArray(
    id: string,
    branch: CollectionBranch,
    user: DecodedUserObject,
  ): Promise<UpdateResult> {
    const collectionId = new ObjectId(id);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: {
        id: user._id.toString(),
        name: user.name,
      },
    };
    const data = await this.db.collection(Collections.COLLECTION).updateOne(
      { _id: collectionId },
      {
        $push: {
          branches: branch,
        },
        $set: {
          ...defaultParams,
        },
      },
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
    payload: Partial<Collection>,
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
    request: Partial<CollectionRequestDto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    const _id = new ObjectId(collectionId);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: user.name,
    };
    if (request.items.type === ItemTypeEnum.REQUEST) {
      request.items = { ...request.items, ...defaultParams };
      await this.db.collection<Collection>(Collections.COLLECTION).updateOne(
        { _id, "items.id": requestId },
        {
          $set: {
            "items.$.name": request.items.name,
            "items.$.description": request.items.description,
            "items.$.request": request.items.request,
            "items.$.updatedAt": new Date(),
            updatedAt: new Date(),
            updatedBy: {
              id: user._id.toString(),
              name: user.name,
            },
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
            "items.$[i].items.$[j].name": request.items.items.name,
            "items.$[i].items.$[j].description":
              request.items.items.description,
            "items.$[i].items.$[j].request": request.items.items.request,
            "items.$[i].items.$[j].updatedAt": new Date(),
            updatedAt: new Date(),
            updatedBy: {
              id: user._id.toString(),
              name: user.name,
            },
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
    user: DecodedUserObject,
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
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
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
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
    }
  }

  async getActiveSyncedCollection(
    title: string,
    workspaceId: string,
  ): Promise<WithId<Collection>> {
    const workspaceDetails = await this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .findOne(
        {
          _id: new ObjectId(workspaceId),
        },
        { projection: { collection: 1 } },
      );

    if (workspaceDetails && workspaceDetails.collection) {
      const activeCollection = workspaceDetails.collection.find(
        (collection) =>
          collection.activeSync === true && collection.name === title,
      );
      const data = await this.db
        .collection<Collection>(Collections.COLLECTION)
        .findOne({ _id: activeCollection?.id, activeSync: true });
      return data;
    }
  }

  /**
   * Adds a WebSocket item to the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param websocket - The WebSocket item to be added.
   * @param noOfRequests - The current number of requests.
   * @returns A promise that resolves to the result of the update operation.
   */
  async addWebSocket(
    collectionId: string,
    websocket: CollectionItem,
    noOfRequests: number,
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .updateOne(
        { _id },
        {
          $push: {
            items: websocket,
          },
          $set: {
            totalRequests: noOfRequests + 1,
          },
        },
      );
    return data;
  }

  /**
   * Adds a WebSocket item to a specific folder within the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param websocket - The WebSocket item to be added.
   * @param noOfRequests - The current number of requests.
   * @param folderId - The ID of the folder.
   * @returns A promise that resolves to the result of the update operation.
   * @throws BadRequestException if the folder does not exist.
   */
  async addWebSocketInFolder(
    collectionId: string,
    websocket: CollectionItem,
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
          { _id, "items.name": websocket.name },
          {
            $push: { "items.$.items": websocket.items[0] },
            $set: {
              totalRequests: noOfRequests + 1,
            },
          },
        );
    } else {
      throw new BadRequestException(ErrorMessages.Unauthorized);
    }
  }

  /**
   * Updates a WebSocket item in the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param websocketId - The ID of the WebSocket item to be updated.
   * @param websocket - The updated WebSocket item.
   * @returns A promise that resolves to the updated WebSocket item.
   */
  async updateWebSocket(
    collectionId: string,
    websocketId: string,
    websocket: Partial<CollectionWebSocketDto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    const _id = new ObjectId(collectionId);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: user.name,
    };
    if (websocket.items.type === ItemTypeEnum.WEBSOCKET) {
      websocket.items = { ...websocket.items, ...defaultParams };
      const data = await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          { _id, "items.id": websocketId },
          {
            $set: {
              "items.$": websocket.items,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
      return { ...data, ...websocket.items, id: websocketId };
    } else {
      websocket.items.items = {
        ...websocket.items.items,
        ...defaultParams,
      };
      const data = await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          {
            _id,
            "items.id": websocket.folderId,
            "items.items.id": websocketId,
          },
          {
            $set: {
              "items.$[i].items.$[j]": websocket.items.items,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
          {
            arrayFilters: [
              { "i.id": websocket.folderId },
              { "j.id": websocketId },
            ],
          },
        );
      return { ...data, ...websocket.items.items, id: websocketId };
    }
  }

  /**
   * Deletes a WebSocket item from the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param websocketId - The ID of the WebSocket item to be deleted.
   * @param noOfRequests - The current number of requests.
   * @param folderId - (Optional) The ID of the folder containing the WebSocket item.
   * @returns A promise that resolves to the result of the delete operation.
   */
  async deleteWebSocket(
    collectionId: string,
    websocketId: string,
    noOfRequests: number,
    user: DecodedUserObject,
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
                id: websocketId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
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
                id: websocketId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
    }
  }

  /**
   * Adds a Socket.IO item to the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param socketio - The Socket.IO item to be added.
   * @param noOfRequests - The current number of requests.
   * @returns A promise that resolves to the result of the update operation.
   */
  async addSocketIO(
    collectionId: string,
    socketio: CollectionItem,
    noOfRequests: number,
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .updateOne(
        { _id },
        {
          $push: {
            items: socketio,
          },
          $set: {
            totalRequests: noOfRequests + 1,
          },
        },
      );
    return data;
  }

  /**
   * Adds a Socket.IO item to a specific folder within the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param socketio - The Socket.IO item to be added.
   * @param noOfRequests - The current number of requests.
   * @param folderId - The ID of the folder.
   * @returns A promise that resolves to the result of the update operation.
   * @throws BadRequestException if the folder does not exist.
   */
  async addSocketIOInFolder(
    collectionId: string,
    socketio: CollectionItem,
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
          { _id, "items.name": socketio.name },
          {
            $push: { "items.$.items": socketio.items[0] },
            $set: {
              totalRequests: noOfRequests + 1,
            },
          },
        );
    } else {
      throw new BadRequestException("Folder Not Found.");
    }
  }

  /**
   * Updates a Socket.IO item in the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param socketioId - The ID of the Socket.IO item to be updated.
   * @param socketio - The updated Socket.IO item.
   * @returns A promise that resolves to the updated Socket.IO item.
   */
  async updateSocketIO(
    collectionId: string,
    socketioId: string,
    socketio: Partial<CollectionSocketIODto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    const _id = new ObjectId(collectionId);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: user.name,
    };
    if (socketio.items.type === ItemTypeEnum.SOCKETIO) {
      socketio.items = { ...socketio.items, ...defaultParams };
      const data = await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          { _id, "items.id": socketioId },
          {
            $set: {
              "items.$": socketio.items,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
      return { ...data, ...socketio.items, id: socketioId };
    } else {
      socketio.items.items = {
        ...socketio.items.items,
        ...defaultParams,
      };
      const data = await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          {
            _id,
            "items.id": socketio.folderId,
            "items.items.id": socketioId,
          },
          {
            $set: {
              "items.$[i].items.$[j]": socketio.items.items,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
          {
            arrayFilters: [
              { "i.id": socketio.folderId },
              { "j.id": socketioId },
            ],
          },
        );
      return { ...data, ...socketio.items.items, id: socketioId };
    }
  }

  /**
   * Deletes a Socket.IO item from the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param socketioId - The ID of the Socket.IO item to be deleted.
   * @param noOfRequests - The current number of requests.
   * @param folderId - (Optional) The ID of the folder containing the Socket.IO item.
   * @returns A promise that resolves to the result of the delete operation.
   */
  async deleteSocketIO(
    collectionId: string,
    socketioId: string,
    noOfRequests: number,
    user: DecodedUserObject,
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
                id: socketioId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
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
                id: socketioId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
    }
  }

  /**
   * Adds a GraphQL item to the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param graphql - The GraphQL item to be added.
   * @param noOfRequests - The current number of requests.
   * @returns A promise that resolves to the result of the update operation.
   */
  async addGraphQL(
    collectionId: string,
    graphql: CollectionItem,
    noOfRequests: number,
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .updateOne(
        { _id },
        {
          $push: {
            items: graphql,
          },
          $set: {
            totalRequests: noOfRequests + 1,
          },
        },
      );
    return data;
  }

  /**
   * Adds a GraphQL item to a specific folder within the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param graphql - The GraphQL item to be added.
   * @param noOfRequests - The current number of requests.
   * @param folderId - The ID of the folder.
   * @returns A promise that resolves to the result of the update operation.
   * @throws BadRequestException if the folder does not exist.
   */
  async addGraphQLInFolder(
    collectionId: string,
    graphql: CollectionItem,
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
          { _id, "items.name": graphql.name },
          {
            $push: { "items.$.items": graphql.items[0] },
            $set: {
              totalRequests: noOfRequests + 1,
            },
          },
        );
    } else {
      throw new BadRequestException("Folder Not Found.");
    }
  }

  /**
   * Updates a GraphQL item in the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param graphqlId - The ID of the GraphQL item to be updated.
   * @param graphql - The updated GraphQL item.
   * @returns A promise that resolves to the updated GraphQL item.
   */
  async updateGraphQL(
    collectionId: string,
    graphqlId: string,
    graphql: Partial<CollectionGraphQLDto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    const _id = new ObjectId(collectionId);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: user.name,
    };
    if (graphql.items.type === ItemTypeEnum.GRAPHQL) {
      graphql.items = { ...graphql.items, ...defaultParams };
      const data = await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          { _id, "items.id": graphqlId },
          {
            $set: {
              "items.$": graphql.items,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
      return { ...data, ...graphql.items, id: graphqlId };
    } else {
      graphql.items.items = {
        ...graphql.items.items,
        ...defaultParams,
      };
      const data = await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          {
            _id,
            "items.id": graphql.folderId,
            "items.items.id": graphqlId,
          },
          {
            $set: {
              "items.$[i].items.$[j]": graphql.items.items,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
          {
            arrayFilters: [{ "i.id": graphql.folderId }, { "j.id": graphqlId }],
          },
        );
      return { ...data, ...graphql.items.items, id: graphqlId };
    }
  }

  /**
   * Deletes a GraphQL item from the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param graphqlId - The ID of the GraphQL item to be deleted.
   * @param noOfRequests - The current number of requests.
   * @param folderId - (Optional) The ID of the folder containing the GraphQL item.
   * @returns A promise that resolves to the result of the delete operation.
   */
  async deleteGraphQL(
    collectionId: string,
    graphqlId: string,
    noOfRequests: number,
    user: DecodedUserObject,
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
                id: graphqlId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
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
                id: graphqlId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
    }
  }

  /**
   * Adds a request response to a request inside a collection.
   *
   * @param collectionId - The ID of the collection.
   * @param requestId - The ID of the request to which the response is added.
   * @param requestResponse - The request response data to add.
   * @returns The result of the update operation.
   */
  async addRequestResponse(
    collectionId: string,
    requestId: string,
    requestResponse: CollectionItem,
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .updateOne(
        {
          _id,
          "items.id": requestId, // Find the request inside items
        },
        {
          $push: {
            "items.$.items": requestResponse, // Push inside the found request
          },
        },
      );
    return data;
  }

  /**
   * Adds a request response inside a folder within a collection.
   *
   * @param collectionId - The ID of the collection.
   * @param requestId - The ID of the request inside the folder.
   * @param requestResponse - The request response data to add.
   * @param folderId - The ID of the folder containing the request.
   * @returns  The result of the update operation.
   */
  async addRequestResponseInFolder(
    collectionId: string,
    requestId: string,
    requestResponse: CollectionItem,
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
          {
            _id,
            "items.id": folderId, // Find the folder
            "items.items.id": requestId, // Find the request inside the folder
          },
          {
            $push: {
              "items.$[i].items.$[j].items": requestResponse, // Push inside the correct request
            },
          },
          {
            arrayFilters: [
              { "i.id": folderId }, // Locate the folder
              { "j.id": requestId }, // Locate the request inside the folder
            ],
          },
        );
    } else {
      throw new BadRequestException("Folder Not Found.");
    }
  }

  /**
   * Updates a request response inside a collection or folder.
   *
   * @param collectionId - The ID of the collection.
   * @param responseId - The ID of the response to update.
   * @param requestResponse - The updated response data.
   */
  async updateRequestResponse(
    collectionId: string,
    responseId: string, // The requestResponse to update
    requestResponse: Partial<UpdateCollectionRequestResponseDto>, // New requestResponse data
    user: DecodedUserObject,
  ): Promise<Partial<UpdateCollectionRequestResponseDto>> {
    const _id = new ObjectId(collectionId);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: {
        id: user._id.toString(),
        name: user.name,
      },
    };

    // Merge updated fields with default parameters

    if (!requestResponse?.folderId) {
      // Case: No Folder (request exists inside `items`)
      const updateObject: Record<string, any> = {
        updatedAt: defaultParams.updatedAt,
        updatedBy: defaultParams.updatedBy,
      };

      if (requestResponse?.name !== undefined) {
        updateObject["items.$[i].items.$[j].name"] = requestResponse.name;
      }
      if (requestResponse?.description !== undefined) {
        updateObject["items.$[i].items.$[j].description"] =
          requestResponse.description;
      }
      if (requestResponse?.selectedResponseBodyType !== undefined) {
        updateObject[
          "items.$[i].items.$[j].requestResponse.selectedResponseBodyType"
        ] = requestResponse.selectedResponseBodyType;
      }
      await this.db.collection<Collection>(Collections.COLLECTION).updateOne(
        {
          _id,
          "items.id": requestResponse.requestId, // Find the request inside `items`
          "items.items.id": responseId, // Find the requestResponse inside the request
        },
        { $set: updateObject },
        {
          arrayFilters: [
            { "i.id": requestResponse.requestId }, // Locate the request
            { "j.id": responseId }, // Locate the requestResponse
          ],
        },
      );
    } else {
      // Case: Inside a Folder (request exists inside `items.items`)
      const updateObject: Record<string, any> = {
        updatedAt: defaultParams.updatedAt,
        updatedBy: defaultParams.updatedBy,
      };

      if (requestResponse?.name !== undefined) {
        updateObject["items.$[i].items.$[j].items.$[k].name"] =
          requestResponse.name;
      }
      if (requestResponse?.description !== undefined) {
        updateObject["items.$[i].items.$[j].items.$[k].description"] =
          requestResponse.description;
      }
      if (requestResponse?.selectedResponseBodyType !== undefined) {
        updateObject[
          "items.$[i].items.$[j].items.$[k].requestResponse.selectedResponseBodyType"
        ] = requestResponse.selectedResponseBodyType;
      }
      await this.db.collection<Collection>(Collections.COLLECTION).updateOne(
        {
          _id,
          "items.id": requestResponse.folderId, // Find the folder inside `items`
          "items.items.id": requestResponse.requestId, // Find the request inside the folder
          "items.items.items.id": responseId, // Find the requestResponse inside the request
        },
        { $set: updateObject },
        {
          arrayFilters: [
            { "i.id": requestResponse.folderId }, // Locate the folder
            { "j.id": requestResponse.requestId }, // Locate the request inside the folder
            { "k.id": responseId }, // Locate the requestResponse inside the request
          ],
        },
      );
    }

    return { ...requestResponse, responseId: responseId };
  }

  /**
   * Deletes a request response from a request inside a collection or folder.
   *
   * @param collectionId - The ID of the collection.
   * @param requestId - The ID of the request that contains the response.
   * @param responseId - The ID of the response to delete.
   * @param folderId - Optional folder ID if the request is inside a folder.
   */
  async deleteRequestResponse(
    collectionId: string,
    requestId: string, // The request where the requestResponse exists
    responseId: string, // The requestResponse to delete
    user: DecodedUserObject,
    folderId?: string, // Optional folderId (if the request is inside a folder)
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    const updatedBy = {
      id: user._id.toString(),
      name: user.name,
    };

    if (!folderId) {
      // Case: No Folder (request exists inside `items`)
      return await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          {
            _id,
            "items.id": requestId, // Find the request inside `items`
          },
          {
            $pull: {
              "items.$.items": { id: responseId }, // Remove the requestResponse from `items.items`
            },
            $set: {
              updatedAt: new Date(),
              updatedBy: updatedBy,
            },
          },
        );
    } else {
      // Case: Inside a Folder (request exists inside `items.items`)
      return await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          {
            _id,
            "items.id": folderId, // Find the folder inside `items`
            "items.items.id": requestId, // Find the request inside the folder
          },
          {
            $pull: {
              "items.$[i].items.$[j].items": { id: responseId }, // Remove the requestResponse from `items.items.items`
            },
            $set: {
              updatedAt: new Date(),
              updatedBy: updatedBy,
            },
          },
          {
            arrayFilters: [
              { "i.id": folderId }, // Locate the folder
              { "j.id": requestId }, // Locate the request inside the folder
            ],
          },
        );
    }
  }

  async addMockRequest(
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

  async addMockRequestInFolder(
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
  async updateMockRequest(
    collectionId: string,
    mockRequestId: string,
    request: Partial<CollectionRequestDto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    const _id = new ObjectId(collectionId);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: user.name,
    };
    if (request.items.type === ItemTypeEnum.MOCK_REQUEST) {
      request.items = { ...request.items, ...defaultParams };
      await this.db.collection<Collection>(Collections.COLLECTION).updateOne(
        { _id, "items.id": mockRequestId },
        {
          $set: {
            "items.$.name": request.items.name,
            "items.$.description": request.items.description,
            "items.$.mockRequest": request.items.mockRequest,
            "items.$.items": request.items?.items,
            "items.$.updatedAt": new Date(),
            updatedAt: new Date(),
            updatedBy: {
              id: user._id.toString(),
              name: user.name,
            },
          },
        },
      );
      return { ...request.items, id: mockRequestId };
    } else {
      request.items.items = { ...request.items.items, ...defaultParams };
      await this.db.collection<Collection>(Collections.COLLECTION).updateOne(
        {
          _id,
          "items.id": request.folderId,
          "items.items.id": mockRequestId,
        },
        {
          $set: {
            "items.$[i].items.$[j].name": request.items.items.name,
            "items.$[i].items.$[j].items": request.items.items?.items,
            "items.$[i].items.$[j].description":
              request.items.items.description,
            "items.$[i].items.$[j].mockRequest":
              request.items.items.mockRequest,
            "items.$[i].items.$[j].updatedAt": new Date(),
            updatedAt: new Date(),
            updatedBy: {
              id: user._id.toString(),
              name: user.name,
            },
          },
        },
        {
          arrayFilters: [
            { "i.id": request.folderId },
            { "j.id": mockRequestId },
          ],
        },
      );
      return { ...request.items.items, id: mockRequestId };
    }
  }

  async deleteMockRequest(
    collectionId: string,
    mockRequestId: string,
    noOfRequests: number,
    user: DecodedUserObject,
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
                id: mockRequestId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
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
                id: mockRequestId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
    }
  }

  /**
   * Fetches the mock collection from DB
   * @param _id mock collection id
   * @returns Mock collection or null
   */
  async getMockCollection(_id: ObjectId): Promise<Collection | null> {
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .findOne({
        _id,
        collectionType: CollectionTypeEnum.MOCK,
        isMockCollectionRunning: true,
      });

    return data;
  }

  /**
   * Adds a AI Request item to the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param aiRequest - The AI Request item to be added.
   * @param noOfRequests - The current number of requests.
   * @returns A promise that resolves to the result of the update operation.
   */
  async addAiRequest(
    collectionId: string,
    aiRequest: CollectionItem,
    noOfRequests: number,
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .updateOne(
        { _id },
        {
          $push: {
            items: aiRequest,
          },
          $set: {
            totalRequests: noOfRequests + 1,
          },
        },
      );
    return data;
  }

  /**
   * Adds a AI Request item to a specific folder within the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param aiRequest - The AI Request item to be added.
   * @param noOfRequests - The current number of requests.
   * @param folderId - The ID of the folder.
   * @returns A promise that resolves to the result of the update operation.
   * @throws BadRequestException if the folder does not exist.
   */
  async addAiRequestInFolder(
    collectionId: string,
    aiRequest: CollectionItem,
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
          { _id, "items.name": aiRequest.name },
          {
            $push: { "items.$.items": aiRequest.items[0] },
            $set: {
              totalRequests: noOfRequests + 1,
            },
          },
        );
    } else {
      throw new BadRequestException("Folder Not Found.");
    }
  }

  /**
   * Updates a AI Request item in the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param aiRequestId - The ID of the AI Request item to be updated.
   * @param aiRequest - The updated AI Request item.
   * @returns A promise that resolves to the updated AI Request item.
   */
  async updateAiRequest(
    collectionId: string,
    aiRequestId: string,
    aiRequest: Partial<CollectionSocketIODto>,
    user: DecodedUserObject,
  ): Promise<CollectionRequestItem> {
    const _id = new ObjectId(collectionId);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: user.name,
    };
    if (aiRequest.items.type === ItemTypeEnum.AI_REQUEST) {
      aiRequest.items = { ...aiRequest.items, ...defaultParams };
      const data = await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          { _id, "items.id": aiRequestId },
          {
            $set: {
              "items.$": aiRequest.items,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
      return { ...data, ...aiRequest.items, id: aiRequestId };
    } else {
      aiRequest.items.items = {
        ...aiRequest.items.items,
        ...defaultParams,
      };
      const data = await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          {
            _id,
            "items.id": aiRequest.folderId,
            "items.items.id": aiRequestId,
          },
          {
            $set: {
              "items.$[i].items.$[j]": aiRequest.items.items,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
          {
            arrayFilters: [
              { "i.id": aiRequest.folderId },
              { "j.id": aiRequestId },
            ],
          },
        );
      return { ...data, ...aiRequest.items.items, id: aiRequestId };
    }
  }

  /**
   * Deletes a AI Request item from the collection.
   *
   * @param collectionId - The ID of the collection.
   * @param aiRequestId - The ID of the A item to be deleted.
   * @param noOfRequests - The current number of requests.
   * @param folderId - (Optional) The ID of the folder containing the A item.
   * @returns A promise that resolves to the result of the delete operation.
   */
  async deleteAiRequest(
    collectionId: string,
    aiRequestId: string,
    noOfRequests: number,
    user: DecodedUserObject,
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
                id: aiRequestId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
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
                id: aiRequestId,
              },
            },
            $set: {
              totalRequests: noOfRequests - 1,
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
    }
  }

  async addMockRequestHistory(
    collectionId: string,
    historyEntry: any,
  ): Promise<void> {
    await this.db
      .collection<Collection>(Collections.COLLECTION)
      .updateOne(
        { _id: new ObjectId(collectionId) },
        { $push: { mockRequestHistory: historyEntry } },
      );
  }

  // ...existing code...

  /**
   * Adds a mock request response to a mock request inside a collection.
   *
   * @param collectionId - The ID of the collection.
   * @param mockRequestId - The ID of the mock request to which the response is added.
   * @param mockRequestResponse - The mock request response data to add.
   * @returns The result of the update operation.
   */
  async addMockRequestResponse(
    collectionId: string,
    mockRequestId: string,
    mockRequestResponse: CollectionItem,
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    const data = await this.db
      .collection<Collection>(Collections.COLLECTION)
      .updateOne(
        {
          _id,
          "items.id": mockRequestId, // Find the mock request inside items
        },
        {
          $push: {
            "items.$.items": mockRequestResponse, // Push inside the found mock request
          },
        },
      );
    return data;
  }

  /**
   * Adds a mock request response inside a folder within a collection.
   *
   * @param collectionId - The ID of the collection.
   * @param mockRequestId - The ID of the mock request inside the folder.
   * @param mockRequestResponse - The mock request response data to add.
   * @param folderId - The ID of the folder containing the mock request.
   * @returns The result of the update operation.
   */
  async addMockRequestResponseInFolder(
    collectionId: string,
    mockRequestId: string,
    mockRequestResponse: CollectionItem,
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
          {
            _id,
            "items.id": folderId, // Find the folder
            "items.items.id": mockRequestId, // Find the mock request inside the folder
          },
          {
            $push: {
              "items.$[i].items.$[j].items": mockRequestResponse, // Push inside the correct mock request
            },
          },
          {
            arrayFilters: [
              { "i.id": folderId }, // Locate the folder
              { "j.id": mockRequestId }, // Locate the mock request inside the folder
            ],
          },
        );
    } else {
      throw new BadRequestException("Folder Not Found.");
    }
  }

  /**
   * Updates a mock request response inside a collection or folder.
   *
   * @param collectionId - The ID of the collection.
   * @param responseId - The ID of the mock response to update.
   * @param mockRequestResponse - The updated mock response data.
   */
  async updateMockRequestResponse(
    collectionId: string,
    responseId: string, // The mockRequestResponse to update
    mockRequestResponse: Partial<UpdateCollectionMockRequestResponseDto>, // New mockRequestResponse data
    user: DecodedUserObject,
  ): Promise<Partial<UpdateCollectionMockRequestResponseDto>> {
    const _id = new ObjectId(collectionId);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: {
        id: user._id.toString(),
        name: user.name,
      },
    };

    if (!mockRequestResponse?.folderId) {
      // Case: No Folder (mock request exists inside `items`)
      const updateObject: Record<string, any> = {
        updatedAt: defaultParams.updatedAt,
        updatedBy: defaultParams.updatedBy,
      };

      if (mockRequestResponse?.name !== undefined) {
        updateObject["items.$[i].items.$[j].name"] = mockRequestResponse.name;
      }
      if (mockRequestResponse?.description !== undefined) {
        updateObject["items.$[i].items.$[j].description"] =
          mockRequestResponse.description;
      }
      if (mockRequestResponse?.isMockResponseActive !== undefined) {
        updateObject[
          "items.$[i].items.$[j].mockRequestResponse.isMockResponseActive"
        ] = mockRequestResponse.isMockResponseActive;
      }
      await this.db.collection<Collection>(Collections.COLLECTION).updateOne(
        {
          _id,
          "items.id": mockRequestResponse.mockRequestId, // Find the mock request inside `items`
          "items.items.id": responseId, // Find the mockRequestResponse inside the mock request
        },
        { $set: updateObject },
        {
          arrayFilters: [
            { "i.id": mockRequestResponse.mockRequestId }, // Locate the mock request
            { "j.id": responseId }, // Locate the mockRequestResponse
          ],
        },
      );
    } else {
      // Case: Inside a Folder (mock request exists inside `items.items`)
      const updateObject: Record<string, any> = {
        updatedAt: defaultParams.updatedAt,
        updatedBy: defaultParams.updatedBy,
      };

      if (mockRequestResponse?.name !== undefined) {
        updateObject["items.$[i].items.$[j].items.$[k].name"] =
          mockRequestResponse.name;
      }
      if (mockRequestResponse?.description !== undefined) {
        updateObject["items.$[i].items.$[j].items.$[k].description"] =
          mockRequestResponse.description;
      }
      if (mockRequestResponse?.isMockResponseActive !== undefined) {
        updateObject[
          "items.$[i].items.$[j].items.$[k].mockRequestResponse.isMockResponseActive"
        ] = mockRequestResponse.isMockResponseActive;
      }
      await this.db.collection<Collection>(Collections.COLLECTION).updateOne(
        {
          _id,
          "items.id": mockRequestResponse.folderId, // Find the folder inside `items`
          "items.items.id": mockRequestResponse.mockRequestId, // Find the mock request inside the folder
          "items.items.items.id": responseId, // Find the mockRequestResponse inside the mock request
        },
        { $set: updateObject },
        {
          arrayFilters: [
            { "i.id": mockRequestResponse.folderId }, // Locate the folder
            { "j.id": mockRequestResponse.mockRequestId }, // Locate the mock request inside the folder
            { "k.id": responseId }, // Locate the mockRequestResponse inside the mock request
          ],
        },
      );
    }

    return { ...mockRequestResponse, mockResponseId: responseId };
  }

  /**
   * Deletes a mock request response from a mock request inside a collection or folder.
   *
   * @param collectionId - The ID of the collection.
   * @param mockRequestId - The ID of the mock request that contains the response.
   * @param responseId - The ID of the mock response to delete.
   * @param folderId - Optional folder ID if the mock request is inside a folder.
   */
  async deleteMockRequestResponse(
    collectionId: string,
    mockRequestId: string, // The mock request where the mockRequestResponse exists
    responseId: string, // The mockRequestResponse to delete
    user: DecodedUserObject,
    folderId?: string, // Optional folderId (if the mock request is inside a folder)
  ): Promise<UpdateResult<Collection>> {
    const _id = new ObjectId(collectionId);
    // const updatedBy = {
    //   id: this.contextService.get("user")._id,
    //   name: this.contextService.get("user").name,
    // };

    if (!folderId) {
      // Case: No Folder (mock request exists inside `items`)
      return await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          {
            _id,
            "items.id": mockRequestId, // Find the mock request inside `items`
          },
          {
            $pull: {
              "items.$.items": { id: responseId }, // Remove the mockRequestResponse from `items.items`
            },
            $set: {
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
        );
    } else {
      // Case: Inside a Folder (mock request exists inside `items.items`)
      return await this.db
        .collection<Collection>(Collections.COLLECTION)
        .updateOne(
          {
            _id,
            "items.id": folderId, // Find the folder inside `items`
            "items.items.id": mockRequestId, // Find the mock request inside the folder
          },
          {
            $pull: {
              "items.$[i].items.$[j].items": { id: responseId }, // Remove the mockRequestResponse from `items.items.items`
            },
            $set: {
              updatedAt: new Date(),
              updatedBy: {
                id: user._id.toString(),
                name: user.name,
              },
            },
          },
          {
            arrayFilters: [
              { "i.id": folderId }, // Locate the folder
              { "j.id": mockRequestId }, // Locate the mock request inside the folder
            ],
          },
        );
    }
  }

  // ...existing code...
}
