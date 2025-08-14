import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import {
  AuthCollection,
  AuthProfiles,
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
  AuthModeEnum,
  BodyModeEnum,
  Collection,
  CollectionAuthModeEnum,
  CollectionBranch,
  CollectionItem,
  CollectionTypeEnum,
  ItemTypeEnum,
  ResponseBodyModeEnum,
} from "@src/modules/common/models/collection.model";
import { WorkspaceService } from "./workspace.service";
import { BranchRepository } from "../repositories/branch.repository";
import { Branch } from "@src/modules/common/models/branch.model";
import { UpdateBranchDto } from "../payloads/branch.payload";
import { ConfigService } from "@nestjs/config";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { UpdatesType } from "@src/modules/common/enum/updates.enum";
import { ProducerService } from "@src/modules/common/services/event-producer.service";
import { PostmanParserService } from "@src/modules/common/services/postman.parser.service";
import { v4 as uuidv4 } from "uuid";
import { AddTo } from "@src/modules/common/models/collection.rxdb.model";
import { WorkspaceDtoForIdDocument } from "../payloads/workspace.payload";
import {
  Workspace,
  WorkspaceType,
} from "@src/modules/common/models/workspace.model";
import { DecodedUserObject } from "@src/types/fastify";
import { EncryptionService } from "@src/modules/common/services/encryption.service";
import { VariableDto } from "@src/modules/common/models/environment.model";
import { RequestBodyDto } from "@src/modules/common/models/collection.model";

@Injectable()
export class CollectionService {
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly branchRepository: BranchRepository,
    private readonly workspaceService: WorkspaceService,
    private readonly configService: ConfigService,
    private readonly producerService: ProducerService,
    private readonly postmanParserService: PostmanParserService,
    private readonly cryptoService: EncryptionService,
  ) {}

  async createCollection(
    createCollectionDto: Partial<CreateCollectionDto>,
    user: DecodedUserObject,
  ): Promise<InsertOneResult> {
    const workspace = await this.workspaceService.IsWorkspaceAdminOrEditor(
      createCollectionDto.workspaceId,
      user._id,
    );
    await this.checkPermission(createCollectionDto.workspaceId, user._id);

    const newCollection: Collection = {
      name: createCollectionDto.name,
      collectionType:
        createCollectionDto?.collectionType === CollectionTypeEnum.MOCK
          ? CollectionTypeEnum.MOCK
          : CollectionTypeEnum.STANDARD,
      totalRequests: 0,
      createdBy: user.name,
      selectedAuthType: CollectionAuthModeEnum["No Auth"],
      items: [],
      updatedBy: { name: user.name, id: user._id.toString() },
      createdAt: new Date(),
      updatedAt: new Date(),
      defaultSelectedAuthProfile: "",
      authProfiles: [],
    };
    const collection =
      await this.collectionRepository.addCollection(newCollection);
    const currentWorkspaceObject = new ObjectId(
      createCollectionDto.workspaceId,
    );
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceRepository.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );

    const updateMessage = `New Collection "${createCollectionDto.name}" is added in "${workspace.name}" workspace`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
        type: UpdatesType.COLLECTION,
        workspaceId: createCollectionDto.workspaceId,
      }),
    });
    return collection;
  }

  async updateMockCollectionUrl(id: string): Promise<UpdateResult<Collection>> {
    const baseUrl = this.configService.get("app.url");
    const mockUrl = `${baseUrl}/api/mock/${id}`;
    const data = await this.collectionRepository.updateCollection(id, {
      mockCollectionUrl: mockUrl,
      isMockCollectionRunning: false,
    });
    return data;
  }

  async updateMockCollectionRunningStatus(
    workspaceId: string,
    collectionId: string,
    status: boolean,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Collection>> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(workspaceId, user._id);
    const data = await this.collectionRepository.updateCollection(
      collectionId,
      {
        isMockCollectionRunning: status,
      },
    );
    const currentWorkspaceObject = new ObjectId(workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceRepository.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    return data;
  }

  async createSampleData(user: any): Promise<CollectionItem[]> {
    const bodyData = {
      id: 0,
      category: {
        id: 0,
        name: "",
      },
      name: "doggie",
      status: "",
    };
    const sampleRequests: CollectionItem[] = [
      {
        id: uuidv4(),
        name: "Add Pet",
        type: ItemTypeEnum.REQUEST,
        description: "",
        updatedAt: new Date(),
        updatedBy: user.name,
        createdAt: new Date(),
        createdBy: user.name,
        request: {
          method: "POST",
          url: "https://petstore.swagger.io/v2/pet",
          body: {
            raw: JSON.stringify(bodyData),
            urlencoded: [
              {
                key: "",
                value: "",
                checked: false,
              },
            ],
            formdata: {
              text: [
                {
                  key: "",
                  value: "",
                  checked: false,
                },
              ],
              file: [],
            },
          },
          headers: [
            {
              key: "",
              value: "",
              checked: false,
            },
          ],
          queryParams: [
            {
              key: "",
              value: "",
              checked: false,
            },
          ],
          auth: {
            bearerToken: "",
            basicAuth: {
              username: "",
              password: "",
            },
            apiKey: {
              authKey: "",
              authValue: "",
              addTo: AddTo.Header,
            },
          },
          selectedRequestBodyType: BodyModeEnum["application/json"],
          selectedRequestAuthType: AuthModeEnum["No Auth"],
        },
      },
      {
        id: uuidv4(),
        name: "Get Pet",
        type: ItemTypeEnum.REQUEST,
        description: "",
        updatedAt: new Date(),
        updatedBy: user.name,
        createdAt: new Date(),
        createdBy: user.name,
        request: {
          method: "GET",
          url: "https://petstore.swagger.io/v2/pet/{petid}",
          body: {
            raw: "",
            urlencoded: [
              {
                key: "",
                value: "",
                checked: false,
              },
            ],
            formdata: {
              text: [
                {
                  key: "",
                  value: "",
                  checked: false,
                },
              ],
              file: [],
            },
          },
          headers: [
            {
              key: "",
              value: "",
              checked: false,
            },
          ],
          queryParams: [
            {
              key: "",
              value: "",
              checked: false,
            },
          ],
          auth: {
            bearerToken: "",
            basicAuth: {
              username: "",
              password: "",
            },
            apiKey: {
              authKey: "",
              authValue: "",
              addTo: AddTo.Header,
            },
          },
          selectedRequestBodyType: BodyModeEnum["text/plain"],
          selectedRequestAuthType: AuthModeEnum["No Auth"],
        },
      },
      {
        id: uuidv4(),
        name: "Update Pet",
        type: ItemTypeEnum.REQUEST,
        description: "",
        updatedAt: new Date(),
        updatedBy: user.name,
        createdAt: new Date(),
        createdBy: user.name,
        request: {
          method: "PUT",
          url: "https://petstore.swagger.io/v2/pet",
          body: {
            raw: JSON.stringify(bodyData),
            urlencoded: [
              {
                key: "",
                value: "",
                checked: false,
              },
            ],
            formdata: {
              text: [
                {
                  key: "",
                  value: "",
                  checked: false,
                },
              ],
              file: [],
            },
          },
          headers: [
            {
              key: "",
              value: "",
              checked: false,
            },
          ],
          queryParams: [
            {
              key: "",
              value: "",
              checked: false,
            },
          ],
          auth: {
            bearerToken: "",
            basicAuth: {
              username: "",
              password: "",
            },
            apiKey: {
              authKey: "",
              authValue: "",
              addTo: AddTo.Header,
            },
          },
          selectedRequestBodyType: BodyModeEnum["application/json"],
          selectedRequestAuthType: AuthModeEnum["No Auth"],
        },
      },
      {
        id: uuidv4(),
        name: "Delete Pet",
        type: ItemTypeEnum.REQUEST,
        description: "",
        updatedAt: new Date(),
        updatedBy: user.name,
        createdAt: new Date(),
        createdBy: user.name,
        request: {
          method: "DELETE",
          url: "https://petstore.swagger.io/v2/pet/{petid}",
          body: {
            raw: "",
            urlencoded: [
              {
                key: "",
                value: "",
                checked: false,
              },
            ],
            formdata: {
              text: [
                {
                  key: "",
                  value: "",
                  checked: false,
                },
              ],
              file: [],
            },
          },
          headers: [
            {
              key: "",
              value: "",
              checked: false,
            },
          ],
          queryParams: [
            {
              key: "",
              value: "",
              checked: false,
            },
          ],
          auth: {
            bearerToken: "",
            basicAuth: {
              username: "",
              password: "",
            },
            apiKey: {
              authKey: "",
              authValue: "",
              addTo: AddTo.Header,
            },
          },
          selectedRequestBodyType: BodyModeEnum["text/plain"],
          selectedRequestAuthType: AuthModeEnum["No Auth"],
        },
      },
    ];
    return sampleRequests;
  }

  async createDefaultCollection(
    user: DecodedUserObject,
  ): Promise<InsertOneResult> {
    const newCollection: Collection = {
      name: "Sample Collection",
      totalRequests: 4,
      createdBy: user.name,
      selectedAuthType: CollectionAuthModeEnum["No Auth"],
      items: await this.createSampleData(user),
      updatedBy: { name: user.name, id: user._id.toString() },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const collection =
      await this.collectionRepository.addCollection(newCollection);
    return collection;
  }

  async getCollection(id: string): Promise<WithId<Collection>> {
    return await this.collectionRepository.get(id);
  }

  async getAllCollections(
    id: string,
    user: DecodedUserObject,
  ): Promise<WithId<Collection>[]> {
    await this.checkPermission(id, user._id);
    const workspace = await this.workspaceRepository.get(id);

    // ✅ Only define this once
    const decryptAuthValuesInItems = (items: any[]) => {
      const stack = [...items]; // Avoid recursion

      while (stack.length > 0) {
        const item = stack.pop();

        if (!item) continue;

        if (item.type === "AI_REQUEST") {
          const apiKeyAuth = item?.aiRequest?.auth?.apiKey;
          if (apiKeyAuth && typeof apiKeyAuth.authValue === "string") {
            try {
              apiKeyAuth.authValue = this.cryptoService.decrypt(
                apiKeyAuth.authValue,
              );
            } catch (error) {
              console.warn("Failed to decrypt authValue:", error);
            }
          }
        }

        if (item.type === "FOLDER" && Array.isArray(item.items)) {
          stack.push(...item.items);
        }
      }
    };

    const collectionIds =
      workspace.collection?.map((c) => c.id.toString()) || [];
    if (collectionIds.length === 0) return [];
    // Bulk fetch all collections
    const collections =
      await this.collectionRepository.getCollectionsByIds(collectionIds);

    const decryptedCollections = [];
    // 🔄 Only the minimum loop remains
    for (let i = 0; i < collections?.length; i++) {
      // const collection = await this.collectionRepository.get(
      //   workspace.collection[i].id.toString(),
      // );

      if (Array.isArray(collections[i].items)) {
        decryptAuthValuesInItems(collections[i].items);
      }

      decryptedCollections.push(collections[i]);
    }

    return decryptedCollections;
  }

  async getAllPublicWorkspaceCollections(
    id: string,
  ): Promise<WithId<Collection>[]> {
    const workspace = await this.workspaceRepository.get(id);
    if (workspace.workspaceType !== WorkspaceType.PUBLIC) {
      throw new BadRequestException("Workspace is not public.");
    }
    const collectionIds =
      workspace.collection?.map((c) => c.id.toString()) || [];
    if (collectionIds.length === 0) return [];
    const collections =
      await this.collectionRepository.getCollectionsByIds(collectionIds);
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
    user: DecodedUserObject,
  ): Promise<UpdateResult> {
    const workspace = await this.workspaceService.IsWorkspaceAdminOrEditor(
      workspaceId,
      user._id,
    );
    await this.checkPermission(workspaceId, user._id);
    const collection = await this.collectionRepository.get(collectionId);
    const data = await this.collectionRepository.update(
      collectionId,
      updateCollectionDto,
      user,
    );
    const currentWorkspaceObject = new ObjectId(workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceRepository.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    if (updateCollectionDto?.name) {
      const updateMessage = `"${collection.name}" collection is renamed to "${updateCollectionDto.name}" in "${workspace.name}" workspace`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          user,
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
          user,
          type: UpdatesType.COLLECTION,
          workspaceId: workspaceId,
        }),
      });
    }
    return data;
  }

  async addAuthProfile(
    updateCollectionDto: Partial<UpdateCollectionDto>,
    user: DecodedUserObject,
  ): Promise<AuthProfiles> {
    const collectionId = updateCollectionDto.collectionId;
    const authInput = updateCollectionDto.authProfiles?.[0];
    const collection = await this.collectionRepository.get(collectionId);
    const existingAuthNames = (collection.authProfiles || []).map((a: any) =>
      a.name?.toLowerCase(),
    );

    const now = new Date();
    const enrichedAuth = {
      ...authInput,
      authId: uuidv4(),
      createdAt: now,
      updatedAt: now,
      createdBy: {
        id: user._id.toString(),
        name: user.name,
      },
      updatedBy: {
        id: user._id.toString(),
        name: user.name,
      },
    };

    // Unset defaultKey from others if this is the new default
    if (authInput.defaultKey) {
      await this.collectionRepository.unsetDefaultAuth(collectionId);
    }

    // Build update doc
    const updateDoc: any = {
      $push: { authProfiles: enrichedAuth },
      $set: {
        updatedAt: now,
        updatedBy: {
          id: user._id.toString(),
          name: user.name,
        },
      },
    };

    if (authInput.defaultKey === true) {
      updateDoc.$set.defaultSelectedAuthProfile = enrichedAuth.authId;
    }

    await this.collectionRepository.addAuth(collectionId, updateDoc);
    return enrichedAuth;
  }

  async getAuthProfiles(
    collectionId: string,
    user: DecodedUserObject,
  ): Promise<AuthProfiles[]> {
    // const collectionObjectId = new ObjectId(collectionId);
    const collection = await this.collectionRepository.get(collectionId);
    return collection.authProfiles || [];
  }

  async updateAuthProfile(
    payload: AuthCollection,
    user: DecodedUserObject,
  ): Promise<AuthProfiles> {
    const { collectionId, authId, ...authUpdatePayload } = payload;

    if (!ObjectId.isValid(collectionId)) {
      throw new BadRequestException("Invalid collectionId");
    }

    const collection = await this.collectionRepository.get(collectionId);
    if (!collection) {
      throw new BadRequestException("Collection not found");
    }

    const existingAuths = collection.authProfiles || [];
    const targetIndex = existingAuths.findIndex(
      (auth: any) => auth.authId === authId,
    );

    if (targetIndex === -1) {
      throw new BadRequestException("Auth profile not found");
    }

    const now = new Date();

    const updatedAuth = {
      ...existingAuths[targetIndex],
      ...authUpdatePayload,
      authId,
      updatedAt: now,
      updatedBy: {
        id: user._id.toString(),
        name: user.name,
      },
    };

    const updatedAuths = existingAuths.map((auth: any) => {
      if (auth.authId === authId) return updatedAuth;

      // Clear defaultKey in others if this one is being set as default
      if (authUpdatePayload.defaultKey === true) {
        return { ...auth, defaultKey: false };
      }

      return auth;
    });

    const updateDoc: any = {
      $set: {
        authProfiles: updatedAuths,
        updatedAt: now,
        updatedBy: {
          id: user._id.toString(),
          name: user.name,
        },
      },
    };

    if (authUpdatePayload.defaultKey === true) {
      updateDoc.$set.defaultSelectedAuthProfile = authId;
    }

    const result = await this.collectionRepository.updateAuth(
      collectionId,
      updateDoc,
    );
    if (result.modifiedCount === 0) {
      throw new BadRequestException("Auth profile update failed");
    }
    const currentWorkspaceObject = new ObjectId(payload?.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceRepository.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    return updatedAuth;
  }

  async deleteAuthProfile(
    payload: AuthCollection,
    user: DecodedUserObject,
  ): Promise<string> {
    const { collectionId, workspaceId, authId } = payload;
    const data = await this.collectionRepository.deleteAuth(
      collectionId,
      workspaceId,
      authId,
      user,
    );
    const currentWorkspaceObject = new ObjectId(workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceRepository.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    return data;
  }

  async updateBranchArray(
    collectionId: string,
    branch: CollectionBranch,
    workspaceId: string,
    user: DecodedUserObject,
  ): Promise<UpdateResult> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(workspaceId, user._id);
    await this.checkPermission(workspaceId, user._id);
    await this.collectionRepository.get(collectionId);
    const data = await this.collectionRepository.updateBranchArray(
      collectionId,
      branch,
      user,
    );
    return data;
  }

  async deleteCollection(
    id: string,
    workspaceId: string,
    user: DecodedUserObject,
  ): Promise<DeleteResult> {
    const workspace = await this.workspaceService.IsWorkspaceAdminOrEditor(
      workspaceId,
      user._id,
    );
    await this.checkPermission(workspaceId, user._id);
    const collection = await this.getCollection(id);
    const data = await this.collectionRepository.delete(id);
    const currentWorkspaceObject = new ObjectId(workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceRepository.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    const updateMessage = `"${collection.name}" collection is deleted from "${workspace.name}" workspace`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        user,
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
    userId: ObjectId,
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
      updatedBy: userId.toString(),
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
    user: DecodedUserObject,
  ): Promise<WithId<Collection>> {
    const updatedCollection =
      await this.postmanParserService.parsePostmanCollection(jsonObj, user);
    const newCollection = await this.importCollection(updatedCollection);
    const collectionDetails = await this.getCollection(
      newCollection.insertedId.toString(),
    );
    await this.workspaceService.addCollectionInWorkSpace(
      workspaceId,
      {
        id: new ObjectId(collectionDetails._id),
        name: collectionDetails.name,
      },
      user._id,
    );
    return collectionDetails;
  }

  async createMockCollectionFromExisting(
    collectionId: string,
    workspaceId: string,
    user: DecodedUserObject,
  ): Promise<InsertOneResult> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(workspaceId, user._id);

    const originalCollection =
      await this.collectionRepository.get(collectionId);

    if (!originalCollection) {
      throw new BadRequestException("Collection not found");
    }

    const mockItems = this.processItemsForMockCollection(
      originalCollection.items,
    );

    const newMockCollection: Collection = {
      name: originalCollection.name,
      collectionType: CollectionTypeEnum.MOCK,
      totalRequests: this.countValidRequests(mockItems),
      createdBy: originalCollection.createdBy,
      selectedAuthType: CollectionAuthModeEnum["No Auth"],
      items: mockItems,
      updatedBy: { name: originalCollection.createdBy },
      createdAt: new Date(),
      updatedAt: new Date(),
      isMockCollectionRunning: false,
      activeSync: false,
    };

    const mockCollection =
      await this.collectionRepository.addCollection(newMockCollection);

    await this.updateMockCollectionUrl(mockCollection.insertedId.toString());

    const insertedCollection = await this.collectionRepository.get(
      mockCollection.insertedId.toString(),
    );

    if (insertedCollection && insertedCollection.mockCollectionUrl) {
      insertedCollection.items = this.replaceMockRequestUrls(
        insertedCollection.items,
        insertedCollection.mockCollectionUrl,
      );

      await this.collectionRepository.updateCollection(
        insertedCollection._id.toString(),
        { items: insertedCollection.items },
      );
    }

    await this.workspaceService.addCollectionInWorkSpace(
      workspaceId,
      {
        id: insertedCollection._id,
        name: newMockCollection.name,
      },
      user._id,
    );
    const currentWorkspaceObject = new ObjectId(workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceRepository.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    return mockCollection;
  }

  private processItemsForMockCollection(
    items: CollectionItem[],
  ): CollectionItem[] {
    const processedItems: CollectionItem[] = [];

    for (const item of items) {
      if (item.type === ItemTypeEnum.REQUEST) {
        const mockRequest = this.convertRequestToMockRequest(item);
        if (mockRequest) {
          processedItems.push(mockRequest);
        }
      } else if (item.type === ItemTypeEnum.FOLDER) {
        const mockFolder = this.processFolderForMockCollection(item);
        if (mockFolder && mockFolder.items && mockFolder.items.length > 0) {
          processedItems.push(mockFolder);
        }
      }
    }

    return processedItems;
  }

  private processFolderForMockCollection(
    folder: CollectionItem,
  ): CollectionItem | null {
    if (!folder.items || folder.items.length === 0) {
      return null;
    }

    const mockRequests: CollectionItem[] = [];

    for (const item of folder.items) {
      if (item.type === ItemTypeEnum.REQUEST) {
        const mockRequest = this.convertRequestToMockRequest(item);
        if (mockRequest) {
          mockRequests.push(mockRequest);
        }
      }
    }

    if (mockRequests.length === 0) {
      return null;
    }

    return {
      ...folder,
      id: uuidv4(),
      type: ItemTypeEnum.FOLDER,
      items: mockRequests,
    };
  }

  private convertRequestToMockRequest(
    request: CollectionItem,
  ): CollectionItem | null {
    if (!request.request) {
      return null;
    }

    const selectedResponse = this.getMostRecentResponse(request.items || []);

    if (!selectedResponse) {
      return {
        ...request,
        id: uuidv4(),
        type: ItemTypeEnum.MOCK_REQUEST,
        request: null as null,
        items: [] as CollectionItem[],
        mockRequest: {
          ...request.request,
          responseHeaders: [{ key: "", value: "", checked: false }],
          responseBody: "",
          responseStatus: "",
          selectedResponseBodyType: ResponseBodyModeEnum["none"],
        },
      };
    }

    const mockRequest = {
      ...request,
      id: uuidv4(),
      type: ItemTypeEnum.MOCK_REQUEST,
      request: null as null,
      items: [] as CollectionItem[],
      mockRequest: {
        ...request.request,
        responseHeaders:
          selectedResponse.requestResponse?.responseHeaders || [],
        responseBody: selectedResponse.requestResponse?.responseBody || "",
        responseStatus:
          selectedResponse.requestResponse?.responseStatus?.split(" ")[0] || "",
        selectedResponseBodyType:
          selectedResponse.requestResponse?.selectedResponseBodyType ||
          ResponseBodyModeEnum["none"],
      },
    };

    return mockRequest;
  }

  private getMostRecentResponse(
    items: CollectionItem[],
  ): CollectionItem | null {
    if (!items || items.length === 0) {
      return null;
    }

    return items[0];
  }

  private countValidRequests(items: CollectionItem[]): number {
    let count = 0;

    for (const item of items) {
      if (item.type === ItemTypeEnum.MOCK_REQUEST) {
        count++;
      } else if (item.type === ItemTypeEnum.FOLDER && item.items) {
        count += this.countValidRequests(item.items);
      }
    }

    return count;
  }

  private replaceMockRequestUrls(
    items: CollectionItem[],
    mockCollectionUrl: string,
  ): CollectionItem[] {
    return items.map((item) => {
      if (item.type === ItemTypeEnum.MOCK_REQUEST && item.mockRequest) {
        const originalUrl = item.mockRequest.url;
        let newUrl = originalUrl;

        if (originalUrl) {
          if (originalUrl.startsWith("{{")) {
            const pathMatch = originalUrl.match(/}}(.*)$/);
            newUrl = pathMatch?.[1] || "";
          } else {
            try {
              const urlObj = new URL(originalUrl);
              const pathAndQuery =
                urlObj.pathname + urlObj.search + urlObj.hash;
              newUrl = pathAndQuery;
            } catch (error) {
              const pathMatch = originalUrl.match(/^https?:\/\/[^\/]+(.*)$/);
              if (pathMatch) {
                newUrl = pathMatch[1];
              } else {
                newUrl = "";
              }
            }
          }
        }

        return {
          ...item,
          mockRequest: {
            ...item.mockRequest,
            url: newUrl,
          },
        };
      } else if (item.type === ItemTypeEnum.FOLDER && item.items) {
        return {
          ...item,
          items: this.replaceMockRequestUrls(item.items, mockCollectionUrl),
        };
      }

      return item;
    });
  }

  private updatedRequestInCollection(
    generatedVariables: VariableDto[],
    requestItem: any,
  ): any {
    // Helper: replace only outside {{ }} blocks
    const replaceOutsideBraces = (text: string): string => {
      return text.replace(
        /(\{\{.*?\}\})|([^{}]+)/g,
        (match, insideBraces, outside) => {
          if (insideBraces) return insideBraces;
          let updated = outside;
          for (const variable of generatedVariables) {
            if (updated === variable.value) {
              updated = `{{${variable.key}}}`;
            } else if (updated.includes(variable.value)) {
              updated = updated.replace(
                new RegExp(variable.value, "g"),
                `{{${variable.key}}}`,
              );
            }
          }
          return updated;
        },
      );
    };

    // Special updater for array of key-value objects
    const updateKeyValueArray = (arr: any[]) => {
      return arr.map((entry) => ({
        ...entry,
        key:
          typeof entry.key === "string"
            ? replaceOutsideBraces(entry.key)
            : entry.key,
        value:
          typeof entry.value === "string"
            ? replaceOutsideBraces(entry.value)
            : entry.value,
      }));
    };

    // Main recursive update
    const replaceValues = (obj: any): any => {
      if (!obj || typeof obj !== "object") {
        return typeof obj === "string" ? replaceOutsideBraces(obj) : obj;
      }
      const newObj: any = Array.isArray(obj) ? [] : {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === "url" && typeof value === "string") {
          newObj[key] = replaceOutsideBraces(value);
        } else if (key === "headers" && Array.isArray(value)) {
          newObj[key] = updateKeyValueArray(value);
        } else if (key === "queryParams" && Array.isArray(value)) {
          newObj[key] = updateKeyValueArray(value);
        } else if (
          key === "body" &&
          typeof value === "object" &&
          value !== null
        ) {
          const updatedBody = { ...(value as RequestBodyDto) };
          if (typeof updatedBody.raw === "string") {
            updatedBody.raw = replaceOutsideBraces(updatedBody.raw);
          }
          if (Array.isArray(updatedBody.urlencoded)) {
            updatedBody.urlencoded = updateKeyValueArray(
              updatedBody.urlencoded,
            );
          }
          if (
            updatedBody.formdata &&
            typeof updatedBody.formdata === "object"
          ) {
            if (Array.isArray(updatedBody.formdata.text)) {
              updatedBody.formdata.text = updateKeyValueArray(
                updatedBody.formdata.text,
              );
            }
          }
          newObj[key] = updatedBody;
        } else {
          newObj[key] = replaceValues(value);
        }
      }
      return newObj;
    };
    return replaceValues(requestItem);
  }

  public async insertGeneratedVariables(
    collectionId: string,
    generatedPairs: VariableDto[],
    workspaceId: string,
    user: DecodedUserObject,
  ) {
    if (generatedPairs.length < 1 && !collectionId) {
      throw new BadRequestException(
        "Please provide collectionId and Generated Variables.",
      );
    }
    let collectionDocument = await this.getCollection(collectionId);
    if (!collectionDocument) {
      throw new NotFoundException("Collection is not Found.");
    }
    const traverseAndUpdate = (items: any[]) => {
      for (const item of items) {
        if (item.type === ItemTypeEnum.REQUEST) {
          item.request = this.updatedRequestInCollection(
            generatedPairs,
            item.request,
          );
        }
        if (item.type === ItemTypeEnum.SOCKETIO) {
          item.socketio = this.updatedRequestInCollection(
            generatedPairs,
            item.socketio,
          );
        }
        if (item.type === ItemTypeEnum.WEBSOCKET) {
          item.websocket = this.updatedRequestInCollection(
            generatedPairs,
            item.websocket,
          );
        }
        if (item.type === ItemTypeEnum.GRAPHQL) {
          item.graphql = this.updatedRequestInCollection(
            generatedPairs,
            item.graphql,
          );
        }
        // If folder or item has nested items
        if (Array.isArray(item.items) && item.items.length > 0) {
          traverseAndUpdate(item.items);
        }
      }
    };
    traverseAndUpdate(collectionDocument.items);
    const response = await this.updateCollection(
      collectionId,
      collectionDocument,
      workspaceId,
      user,
    );
    return response;
  }
}
