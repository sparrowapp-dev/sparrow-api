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
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import { CollectionGenerateVariableDto } from "@src/modules/common/models/collection.model";

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
    private readonly userRepository: UserRepository,
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
          selectedRequestAuthProfileId: "",
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
          selectedRequestAuthProfileId: "",
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
          selectedRequestAuthProfileId: "",
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
          selectedRequestAuthProfileId: "",
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

  async getCollectionWithGenerateVariable(
    email: string,
    id: string,
  ): Promise<WithId<CollectionGenerateVariableDto>> {
    const collection = await this.collectionRepository.get(id);
    const collectionId = collection._id.toString();
    const userDetails = await this.userRepository.getUserByEmail(email);

    // Case 1: Already processed → not allowed again
    if (
      userDetails.isGenerateVariableTrial.includes(collectionId) ||
      userDetails?.isGenerateVariableDemoCompleted === true
    ) {
      collection.isGenerateVariableTrial = false;
      return collection;
    }
    // Case 2: Not processed yet → check frequency
    const hasExceeded = await this.hasVariableFrequencyExceeded(collectionId);
    collection.isGenerateVariableTrial = hasExceeded;
    return collection;
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

    const userDetails = await this.userRepository.getUserByEmail(user.email);
    for (let i = 0; i < collections.length; i++) {
      const collectionId = collections[i]._id.toString();
      // Case 1: Already processed
      if (
        userDetails.isGenerateVariableTrial.includes(collectionId) ||
        userDetails?.isGenerateVariableDemoCompleted === true
      ) {
        collections[i].isGenerateVariableTrial = false;
        continue;
      }
      // Case 2: Not processed yet → run frequency check
      const hasExceeded = await this.hasVariableFrequencyExceeded(collectionId);
      collections[i].isGenerateVariableTrial = hasExceeded;
    }

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
          if (insideBraces) return insideBraces; // skip {{ }}
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

    const newRequest: any = { ...requestItem };
    // url
    if (typeof newRequest.url === "string") {
      newRequest.url = replaceOutsideBraces(newRequest.url);
    }
    // headers
    if (Array.isArray(newRequest.headers)) {
      newRequest.headers = updateKeyValueArray(newRequest.headers);
    }
    // queryParams
    if (Array.isArray(newRequest.queryParams)) {
      newRequest.queryParams = updateKeyValueArray(newRequest.queryParams);
    }
    // body
    if (typeof newRequest.body === "object" && newRequest.body !== null) {
      const updatedBody = { ...newRequest.body };
      if (typeof updatedBody.raw === "string") {
        updatedBody.raw = replaceOutsideBraces(updatedBody.raw);
      }
      if (Array.isArray(updatedBody.urlencoded)) {
        updatedBody.urlencoded = updateKeyValueArray(updatedBody.urlencoded);
      }
      if (updatedBody.formdata && typeof updatedBody.formdata === "object") {
        if (Array.isArray(updatedBody.formdata.text)) {
          updatedBody.formdata.text = updateKeyValueArray(
            updatedBody.formdata.text,
          );
        }
      }
      newRequest.body = updatedBody;
    }
    return newRequest;
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

  public async hasVariableFrequencyExceeded(
    collectionId: string,
  ): Promise<boolean> {
    const collection =
      await this.collectionRepository.getCollection(collectionId);
    if (!collection) {
      throw new BadRequestException("Collection Not Found");
    }
    // Extract data from collection
    const { urls, bodies, queryParams, headers } = this.extractFromItems(
      collection.items,
    );
    // Generate variables for each type
    const urlVariables = Object.entries(this.generateUrlVariables(urls)).map(
      ([key, value]) => ({
        key,
        value,
        checked: true,
      }),
    );
    if (urlVariables.length > 0) {
      return true;
    }
    const bodyVariables = Object.entries(
      this.generateBodyVariables(bodies),
    ).map(([key, value]) => ({
      key,
      value,
      checked: true,
    }));
    if (bodyVariables.length > 0) {
      return true;
    }
    const queryVariables = Object.entries(
      this.generateQueryVariables(queryParams),
    ).map(([key, value]) => ({
      key,
      value,
      checked: true,
    }));
    if (queryVariables.length > 0) {
      return true;
    }
    const headerVariables = Object.entries(
      this.generateHeaderVariables(headers),
    ).map(([key, value]) => ({
      key,
      value,
      checked: true,
    }));
    if (headerVariables.length > 0) {
      return true;
    }
    return false;
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
      ? arr.filter((entry) => {
          const key = entry?.key?.trim().toLowerCase();
          const value = entry?.value?.trim();
          return (
            key && value && key !== "user-agent" && key !== "accept-encoding"
          );
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
    const headers: any[] = [];

    const traverse = (items: any[]) => {
      for (const item of items) {
        const { type } = item;
        let req = null;

        switch (type) {
          case ItemTypeEnum.REQUEST:
          case ItemTypeEnum.AI_REQUEST:
            req = item.request || item.aiRequest;
            if (req?.url) urls.push(req.url);

            // Headers
            const cleanedHeaders = this.clean(req.headers);
            if (cleanedHeaders.length > 0) {
              headers.push(cleanedHeaders);
            }

            // Body
            const urlencoded = this.clean(req.body?.urlencoded);
            const formdataText = this.clean(req.body?.formdata?.text);
            const formdataFile = this.clean(req.body?.formdata?.file);
            const raw = req.body?.raw || "";

            const body: any = { raw };

            if (urlencoded.length > 0) body.urlencoded = urlencoded;
            if (formdataText.length > 0 || formdataFile.length > 0) {
              body.formdata = {};
              if (formdataText.length > 0) body.formdata.text = formdataText;
              if (formdataFile.length > 0) body.formdata.file = formdataFile;
            }

            const hasBodyContent =
              raw.trim() !== "" ||
              body.urlencoded?.length > 0 ||
              body.formdata?.text?.length > 0 ||
              body.formdata?.file?.length > 0;

            if (hasBodyContent) {
              bodies.push(body);
            }

            // Query params
            const cleanedQueryParams = this.clean(req.queryParams);
            if (cleanedQueryParams.length > 0) {
              queryParams.push(cleanedQueryParams);
            }
            break;

          case ItemTypeEnum.WEBSOCKET:
            req = item.websocket;
            if (req?.url) urls.push(req.url);

            const wsHeaders = this.clean(req.headers);
            if (wsHeaders.length > 0) headers.push(wsHeaders);

            const wsBody: any = {};
            if (req.message?.trim()) wsBody.message = req.message;
            if (Object.keys(wsBody).length > 0) bodies.push(wsBody);

            const cleanedWsQuery = this.clean(req.queryParams);
            if (cleanedWsQuery.length > 0) queryParams.push(cleanedWsQuery);
            break;

          case ItemTypeEnum.SOCKETIO:
            req = item.socketio;
            if (req?.url) urls.push(req.url);

            const socketHeaders = this.clean(req.headers);
            if (socketHeaders.length > 0) headers.push(socketHeaders);

            const socketBody: any = {};
            if (req.message?.trim()) socketBody.message = req.message;
            if (req.eventName?.trim()) socketBody.event = req.eventName;
            if (Object.keys(socketBody).length > 0) bodies.push(socketBody);

            const cleanedSocketQuery = this.clean(req.queryParams);
            if (cleanedSocketQuery.length > 0)
              queryParams.push(cleanedSocketQuery);
            break;

          case ItemTypeEnum.GRAPHQL:
            req = item.graphql;
            if (req?.url) urls.push(req.url);

            const gqlHeaders = this.clean(req.headers);
            if (gqlHeaders.length > 0) headers.push(gqlHeaders);

            const gqlBody: any = {};
            if (req.query?.trim()) gqlBody.query = req.query;
            if (req.mutation?.trim()) gqlBody.mutation = req.mutation;
            if (req.variables?.trim()) gqlBody.variables = req.variables;

            if (Object.keys(gqlBody).length > 0) bodies.push(gqlBody);
            break;

          case ItemTypeEnum.FOLDER:
            if (item.items) traverse(item.items);
            break;

          default:
            break;
        }
      }
    };

    traverse(items);
    return { urls, bodies, queryParams, headers };
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

    urls.forEach((url) => {
      const matches = url.match(existingVariablePattern);
      if (matches) {
        matches.forEach((match) => preservedVariables.add(match));
      }
    });

    // Find common substrings
    const substringFrequency = new Map<
      string,
      { count: number; urls: number[] }
    >();

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
      const parts = cleanUrl
        .split(/[\/\?&=]/)
        .filter((part) => part.length > 0);

      // Generate substrings
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j <= Math.min(parts.length, i + 4); j++) {
          const substring = parts.slice(i, j).join("/");

          // Skip invalid substrings
          if (
            substring.includes("__VAR_") ||
            substring.length < 3 ||
            /^\d+$/.test(substring) ||
            substring.includes("%") ||
            substring.includes("=")
          )
            continue;

          // Find actual substring in original URL
          const urlParts = url.split("/");
          let fullSubstring = "";

          for (let k = 0; k < urlParts.length; k++) {
            for (let l = k + 1; l <= urlParts.length; l++) {
              const testSubstring = urlParts.slice(k, l).join("/");
              if (
                testSubstring.includes(substring) &&
                !Array.from(preservedVariables).some((v) =>
                  testSubstring.includes(v),
                ) &&
                testSubstring.length >= 8
              ) {
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
        return (
          data.count >= threshold &&
          substring.length >= 8 &&
          !Array.from(preservedVariables).some((v) => substring.includes(v))
        );
      })
      .map(([substring, data]) => ({
        substring,
        count: data.count,
        length: substring.length,
        priority: data.count * 1000 + substring.length,
      }))
      .sort((a, b) => b.priority - a.priority);

    // Select non-overlapping candidates
    const selectedCandidates: typeof candidates = [];

    for (const candidate of candidates) {
      let shouldInclude = true;

      for (const selected of selectedCandidates) {
        if (
          candidate.substring.includes(selected.substring) ||
          selected.substring.includes(candidate.substring)
        ) {
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
      variables[`url_var${index + 1}`] = candidate.substring;
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

    const existingVariablePattern = /\{\{?[^}]+\}?\}/; // pre-existing vars like {{VAR}} or {var}
    const valueFrequencyByKey = new Map<string, Map<string, number>>();
    const valueCountByKey: Record<string, number> = {};

    const extractKeyValuePairs = (
      obj: any,
      parentKey = "",
    ): Array<[string, string]> => {
      const pairs: Array<[string, string]> = [];

      if (typeof obj === "string") {
        if (obj.trim() && !existingVariablePattern.test(obj.trim())) {
          pairs.push([parentKey || "body", obj.trim()]);
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item) =>
          pairs.push(...extractKeyValuePairs(item, parentKey)),
        );
      } else if (typeof obj === "object" && obj !== null) {
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
          if (
            item.checked !== false &&
            item.value?.trim() &&
            !existingVariablePattern.test(item.value)
          ) {
            const key = item.key.trim();
            const value = item.value.trim();
            this.addToFrequencyMap(
              key,
              value,
              valueFrequencyByKey,
              valueCountByKey,
            );
          }
        }
      }

      // Process formdata
      if (body.formdata?.text) {
        for (const item of body.formdata.text) {
          if (
            item.checked !== false &&
            item.value?.trim() &&
            !existingVariablePattern.test(item.value)
          ) {
            const key = item.key.trim();
            const value = item.value.trim();
            this.addToFrequencyMap(
              key,
              value,
              valueFrequencyByKey,
              valueCountByKey,
            );
          }
        }
      }

      // Process raw JSON
      if (body.raw?.trim()) {
        try {
          const parsed = JSON.parse(body.raw);
          const keyVals = extractKeyValuePairs(parsed);
          for (const [key, value] of keyVals) {
            this.addToFrequencyMap(
              key,
              value,
              valueFrequencyByKey,
              valueCountByKey,
            );
          }
        } catch {
          // Ignore parsing errors
        }
      }

      // Process other body types (websocket, socketio, graphql)
      ["message", "event", "query", "mutation", "variables"].forEach(
        (field) => {
          if (
            body[field]?.trim() &&
            !existingVariablePattern.test(body[field])
          ) {
            this.addToFrequencyMap(
              field,
              body[field].trim(),
              valueFrequencyByKey,
              valueCountByKey,
            );
          }
        },
      );
    }

    // Generate variables
    const result: Record<string, string> = {};
    const keyVarCounters: Record<string, number> = {};

    for (const [key, valMap] of valueFrequencyByKey.entries()) {
      const threshold = this.getAdaptiveThreshold(valueCountByKey[key]);
      keyVarCounters[key] = keyVarCounters[key] || 1;

      for (const [value, count] of valMap.entries()) {
        if (count >= threshold) {
          const cleanKey = key || "body";
          const varName = `${cleanKey}_var${keyVarCounters[key]++}`;
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
  private generateQueryVariables(
    paramGroups: Array<Array<{ key: string; value: string; checked: boolean }>>,
  ): Record<string, string> {
    if (paramGroups.length === 0) return {};
    const existingVariablePattern = /\{\{?[^}]+\}?\}/; // Matches {{VAR}}, {VAR}

    const keyValueFrequency = new Map<string, Map<string, number>>();
    const keyValueCount: Record<string, number> = {};

    // Count frequencies per key
    for (const group of paramGroups) {
      for (const param of group) {
        if (
          param.value?.trim() &&
          !existingVariablePattern.test(param.value.trim()) // skip pre-existing vars
        ) {
          const key = param.key.trim();
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
          const varName = `${key}_var${keyCounters[key]++}`;
          result[varName] = value;
        }
      }
    }

    return result;
  }

  /**
   * Generates header variables by detecting frequently occurring header values.

    * @returns A record mapping generated variable names to header values.
  */
  private generateHeaderVariables(
    headerGroups: Array<
      Array<{ key: string; value: string; checked: boolean }>
    >,
  ): Record<string, string> {
    if (headerGroups.length === 0) return {};

    const existingVariablePattern = /\{\{?[^}]+\}?\}/; // Matches {{VAR}}, {VAR}

    const keyValueFrequency = new Map<string, Map<string, number>>();
    const keyValueCount: Record<string, number> = {};

    // Count frequencies per header key
    for (const group of headerGroups) {
      for (const header of group) {
        if (
          header.value?.trim() &&
          !existingVariablePattern.test(header.value.trim()) // skip pre-existing vars
        ) {
          const key = header.key.trim();
          const value = header.value.trim();
          this.addToFrequencyMap(key, value, keyValueFrequency, keyValueCount);
        }
      }
    }

    // Generate variable names per header key
    const result: Record<string, string> = {};
    const keyCounters: Record<string, number> = {};

    for (const [key, valMap] of keyValueFrequency.entries()) {
      const threshold = this.getAdaptiveThreshold(keyValueCount[key]);
      keyCounters[key] = keyCounters[key] || 1;

      for (const [value, count] of valMap.entries()) {
        if (count >= threshold) {
          const varName = `${key}_var${keyCounters[key]++}`;
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
    countMap: Record<string, number>,
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
