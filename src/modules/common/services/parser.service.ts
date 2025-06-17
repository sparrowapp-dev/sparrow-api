import SwaggerParser from "@apidevtools/swagger-parser";
import {
  Collection,
  CollectionAuthModeEnum,
  CollectionItem,
  ItemTypeEnum,
  SourceTypeEnum,
} from "../models/collection.model";
import { OpenAPI303 } from "../models/openapi303.model";
import { Injectable } from "@nestjs/common";
import { CollectionService } from "@src/modules/workspace/services/collection.service";
import { ObjectId, WithId } from "mongodb";
import { resolveAllRefs } from "./helper/parser.helper";
import { OpenAPI20 } from "../models/openapi20.model";
import * as oapi2Transformer from "./helper/oapi2.transformer";
import * as oapi3Transformer from "./helper/oapi3.transformer";
import { BranchService } from "@src/modules/workspace/services/branch.service";
import { Branch } from "../models/branch.model";
import { FastifyRequest } from "fastify";
import axios from "axios";
import * as yml from "js-yaml";
import { DecodedUserObject } from "@src/types/fastify";
interface ActiveSyncResponsePayload {
  collection: WithId<Collection>;
  existingCollection: boolean;
}

@Injectable()
export class ParserService {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly branchService: BranchService,
  ) {}

  async parse(
    file: string,
    user: DecodedUserObject,
    activeSync?: boolean,
    workspaceId?: string,
    activeSyncUrl?: string,
    primaryBranch?: string,
    currentBranch?: string,
    localRepositoryPath?: string,
  ): Promise<{
    collection: WithId<Collection>;
    existingCollection: boolean;
  }> {
    let openApiDocument = (await SwaggerParser.parse(file)) as
      | OpenAPI303
      | OpenAPI20
      | any;
    let folderObjMap = new Map();
    if (openApiDocument.hasOwnProperty("components")) {
      openApiDocument = resolveAllRefs(openApiDocument) as OpenAPI303;
      folderObjMap = oapi3Transformer.createCollectionItems(
        openApiDocument,
        user.name,
      );
    } else if (openApiDocument.hasOwnProperty("definitions")) {
      openApiDocument = resolveAllRefs(openApiDocument) as OpenAPI20;
      folderObjMap = oapi2Transformer.createCollectionItems(
        openApiDocument,
        user.name,
      );
    }
    const itemObject = Object.fromEntries(folderObjMap);
    const items: CollectionItem[] = [];
    let totalRequests = 0;
    for (const key in itemObject) {
      if (itemObject.hasOwnProperty(key)) {
        items.push(itemObject[key]);
        delete itemObject[key];
      }
    }
    items.map((itemObj) => {
      totalRequests = totalRequests + itemObj.items?.length;
    });
    let collection: Collection;

    if (activeSync) {
      const { collection, existingCollection } = await this.runActiveSyncFlow(
        openApiDocument,
        workspaceId,
        primaryBranch,
        currentBranch,
        totalRequests,
        activeSyncUrl,
        items,
        localRepositoryPath,
        user,
      );
      return {
        collection,
        existingCollection,
      };
    } else {
      collection = {
        name: openApiDocument.info.title,
        description: openApiDocument.info.description,
        selectedAuthType: CollectionAuthModeEnum["No Auth"],
        primaryBranch: "",
        localRepositoryPath: "",
        branches: [],
        totalRequests,
        items: items,
        uuid: openApiDocument.info.title,
        activeSync: openApiDocument?.isActiveSyncEnabled ?? false,
        activeSyncUrl: openApiDocument?.activeSyncUrl ?? "",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: user._id.toString(),
        updatedBy: {
          id: user._id.toString(),
          name: user.name,
        },
        syncedAt: openApiDocument?.isActiveSyncEnabled ? new Date() : null,
      };
    }

    const newCollection =
      await this.collectionService.importCollection(collection);
    const collectionDetails = await this.collectionService.getCollection(
      newCollection.insertedId.toString(),
    );
    return {
      collection: collectionDetails,
      existingCollection: false,
    };
  }

  async runActiveSyncFlow(
    openApiDocument: OpenAPI20 | OpenAPI303,
    workspaceId: string,
    primaryBranch: string,
    currentBranch: string,
    totalRequests: number,
    activeSyncUrl: string,
    items: CollectionItem[],
    localRepositoryPath: string,
    user: DecodedUserObject,
  ): Promise<ActiveSyncResponsePayload> {
    const collectionTitle = openApiDocument.info.title;
    let mergedFolderItems: CollectionItem[] = [];
    const existingCollection =
      await this.collectionService.getActiveSyncedCollection(
        collectionTitle,
        workspaceId,
      );
    if (existingCollection) {
      //Get existing branch or create one
      const branch = await this.createOrFetchBranch(
        currentBranch,
        existingCollection._id.toString(),
        workspaceId,
        items,
        user,
      );

      //Check items on folder level
      mergedFolderItems = this.compareAndMerge(branch.items, items);
      for (let x = 0; x < branch.items?.length; x++) {
        const newItem: CollectionItem[] = items.filter((item) => {
          return item.name === branch.items[x].name;
        });
        //Check items on request level
        const mergedFolderRequests: CollectionItem[] = this.compareAndMerge(
          branch.items[x].items ?? [],
          newItem[0]?.items || [],
        );
        mergedFolderItems[x].items = mergedFolderRequests;
      }

      this.updateItemsInbranch(
        workspaceId,
        branch._id.toString(),
        mergedFolderItems,
        user._id,
      );

      //Update collection Items
      const updatedCollection = await this.collectionService.getCollection(
        existingCollection._id.toString(),
      );
      updatedCollection.items = mergedFolderItems;

      //No need for this as collection will be fetched from branch model
      // this.updateItemsInCollection(
      //   workspaceId,
      //   existingCollection._id.toString(),
      //   mergedFolderItems,
      // );

      return {
        collection: updatedCollection,
        existingCollection: true,
      };
    }

    const collection: Collection = {
      name: collectionTitle,
      description: openApiDocument.info.description,
      primaryBranch: primaryBranch ?? "",
      localRepositoryPath: localRepositoryPath ?? "",
      totalRequests,
      items: items,
      branches: [],
      uuid: collectionTitle,
      activeSync: true,
      activeSyncUrl: activeSyncUrl ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user._id.toString(),
      updatedBy: {
        id: user._id.toString(),
        name: user.name,
      },
    };
    const insertedCollection =
      await this.collectionService.importCollection(collection);
    const collectionId = insertedCollection.insertedId.toString();
    const branch = await this.branchService.createBranch(
      {
        name: currentBranch,
        items: items,
        collectionId,
      },
      user._id,
    );

    await this.collectionService.updateBranchArray(
      collectionId,
      { id: branch.insertedId.toString(), name: currentBranch },
      workspaceId,
      user,
    );

    return {
      collection: await this.collectionService.getCollection(
        insertedCollection.insertedId.toString(),
      ),
      existingCollection: false,
    };
  }

  async createOrFetchBranch(
    currentBranch: string,
    collectionId: string,
    workspaceId: string,
    items: CollectionItem[],
    user: DecodedUserObject,
  ): Promise<WithId<Branch>> {
    const existingBranch = await this.collectionService.getActiveSyncedBranch(
      collectionId,
      currentBranch,
    );
    if (existingBranch) {
      return existingBranch;
    }
    const insertedBranch = await this.branchService.createBranch(
      {
        name: currentBranch,
        items: items,
        collectionId,
      },
      user._id,
    );
    const branch = await this.branchService.getBranch(
      insertedBranch.insertedId.toString(),
    );
    await this.updateBranchInCollection(
      workspaceId,
      collectionId,
      branch,
      user,
    );
    return branch;
  }

  async updateItemsInbranch(
    workspaceId: string,
    branchId: string,
    items: CollectionItem[],
    userId: ObjectId,
  ) {
    await this.branchService.updateBranch(workspaceId, branchId, items, userId);
  }

  async updateItemsInCollection(
    workspaceId: string,
    collectionId: string,
    items: CollectionItem[],
    user: DecodedUserObject,
  ) {
    await this.collectionService.updateCollection(
      collectionId,
      { items },
      workspaceId,
      user,
    );
  }

  async updateBranchInCollection(
    workspaceId: string,
    collectionId: string,
    branch: WithId<Branch>,
    user: DecodedUserObject,
  ) {
    await this.collectionService.updateBranchArray(
      collectionId,
      { id: branch._id.toString(), name: branch.name },
      workspaceId,
      user,
    );
  }

  async validateOapi(request: FastifyRequest): Promise<void> {
    try {
      let data: any;
      const url = request.headers["x-oapi-url"] || null;
      const oapi = request.body;
      if (url) {
        const response = await axios.get(url as string);
        data = response.data;
      } else {
        try {
          data = yml.load(oapi as string);
          if (data[0] == "object Object") throw new Error();
        } catch (err) {
          data = JSON.stringify(oapi);
          data = oapi;
        }
      }
      await SwaggerParser.parse(data);
      return;
    } catch (err) {
      throw new Error("Invalid OAPI.");
    }
  }

  validateUrlIsALocalhostUrl(url: string): boolean {
    const urlObject = new URL(url); // Create a URL object for parsing

    // Check if protocol is http or https (localhost only works with these)
    if (!["http:", "https:"].includes(urlObject.protocol)) {
      return false;
    }

    // Check if hostname is 'localhost' or starts with 127.0.0.1
    return (
      urlObject.hostname === "localhost" ||
      urlObject.hostname.startsWith("127.0.0.1")
    );
  }

  compareAndMerge(
    existingitems: CollectionItem[],
    newItems: CollectionItem[],
  ): CollectionItem[] {
    const newItemMap = newItems
      ? new Map(
          newItems?.map((item) => [
            item.type === ItemTypeEnum.FOLDER
              ? item.name
              : item.name + item.request?.method,
            item,
          ]),
        )
      : new Map();
    const existingItemMap = existingitems
      ? new Map(
          existingitems?.map((item) => [
            item.type === ItemTypeEnum.FOLDER
              ? item.name
              : item.name + item.request?.method,
            item,
          ]),
        )
      : new Map();
    // Merge old and new items while marking deleted
    const mergedArray: CollectionItem[] = existingitems?.map((existingItem) => {
      if (
        newItemMap.has(
          existingItem.type === ItemTypeEnum.FOLDER
            ? existingItem.name
            : existingItem.name + existingItem.request?.method,
        )
      ) {
        return {
          ...newItemMap.get(
            existingItem.type === ItemTypeEnum.FOLDER
              ? existingItem.name
              : existingItem.name + existingItem.request?.method,
          ),
          isDeleted: false,
        };
      } else if (existingItem.source === SourceTypeEnum.USER) {
        return { ...existingItem, isDeleted: false };
      } else {
        return { ...existingItem, isDeleted: true };
      }
    });
    // Add new items from newArray that are not already in the mergedArray
    newItems.forEach((newItem) => {
      if (
        !existingItemMap.has(
          newItem.type === ItemTypeEnum.FOLDER
            ? newItem.name
            : newItem.name + newItem.request.method,
        )
      ) {
        mergedArray.push({ ...newItem, isDeleted: false });
      }
    });

    return mergedArray;
  }

  async parseOAPICollection(
    file: string,
    user: DecodedUserObject,
  ): Promise<Collection> {
    let openApiDocument = (await SwaggerParser.parse(file)) as
      | OpenAPI303
      | OpenAPI20
      | any;
    let folderObjMap = new Map();
    if (openApiDocument.hasOwnProperty("components")) {
      openApiDocument = resolveAllRefs(openApiDocument) as OpenAPI303;
      folderObjMap = oapi3Transformer.createCollectionItems(
        openApiDocument,
        user.name,
      );
    } else if (openApiDocument.hasOwnProperty("definitions")) {
      openApiDocument = resolveAllRefs(openApiDocument) as OpenAPI20;
      folderObjMap = oapi2Transformer.createCollectionItems(
        openApiDocument,
        user.name,
      );
    }
    const itemObject = Object.fromEntries(folderObjMap);
    const items: CollectionItem[] = [];
    let totalRequests = 0;
    for (const key in itemObject) {
      if (itemObject.hasOwnProperty(key)) {
        items.push(itemObject[key]);
        delete itemObject[key];
      }
    }
    items.map((itemObj) => {
      totalRequests = totalRequests + itemObj.items?.length;
    });

    const collection: Collection = {
      name: openApiDocument.info.title,
      description: openApiDocument.info.description,
      selectedAuthType: CollectionAuthModeEnum["No Auth"],
      primaryBranch: "",
      localRepositoryPath: "",
      branches: [],
      totalRequests,
      items: items,
      uuid: openApiDocument.info.title,
      activeSync: openApiDocument?.isActiveSyncEnabled ?? false,
      activeSyncUrl: openApiDocument?.activeSyncUrl ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user._id.toString(),
      updatedBy: {
        id: user._id.toString(),
        name: user.name,
      },
    };

    return collection;
  }
}
