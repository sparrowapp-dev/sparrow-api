import SwaggerParser from "@apidevtools/swagger-parser";
import {
  Collection,
  CollectionItem,
  ItemTypeEnum,
  SourceTypeEnum,
} from "../models/collection.model";
import { OpenAPI303 } from "../models/openapi303.model";
import { Injectable } from "@nestjs/common";
import { ContextService } from "./context.service";
import { CollectionService } from "@src/modules/workspace/services/collection.service";
import { WithId } from "mongodb";
import { resolveAllRefs } from "./helper/parser.helper";
import { OpenAPI20 } from "../models/openapi20.model";
import * as oapi2Transformer from "./helper/oapi2.transformer";
import * as oapi3Transformer from "./helper/oapi3.transformer";
import { BranchService } from "@src/modules/workspace/services/branch.service";

@Injectable()
export class ParserService {
  constructor(
    private readonly contextService: ContextService,
    private readonly collectionService: CollectionService,
    private readonly branchService: BranchService,
  ) {}

  async parse(
    file: string,
    activeSync?: boolean,
    workspaceId?: string,
    activeSyncUrl?: string,
    primaryBranch?: string,
  ): Promise<{
    collection: WithId<Collection>;
    existingCollection: boolean;
  }> {
    let openApiDocument = (await SwaggerParser.parse(file)) as
      | OpenAPI303
      | OpenAPI20;
    let existingCollection: WithId<Collection> | null = null;
    let folderObjMap = new Map();
    const user = await this.contextService.get("user");
    if (openApiDocument.hasOwnProperty("components")) {
      openApiDocument = resolveAllRefs(openApiDocument) as OpenAPI303;
      folderObjMap = oapi3Transformer.createCollectionItems(
        openApiDocument,
        user,
      );
    } else if (openApiDocument.hasOwnProperty("definitions")) {
      openApiDocument = resolveAllRefs(openApiDocument) as OpenAPI20;
      folderObjMap = oapi2Transformer.createCollectionItems(
        openApiDocument,
        user,
      );
    }
    const itemObject = Object.fromEntries(folderObjMap);
    let items: CollectionItem[] = [];
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
    let branch;
    let collection: Collection;
    let existingBranch;
    if (activeSync) {
      let mergedFolderItems: CollectionItem[] = [];
      existingCollection =
        await this.collectionService.getActiveSyncedCollection(
          openApiDocument.info.title,
          workspaceId,
        );
      if (existingCollection) {
        //check on folder level
        mergedFolderItems = this.compareAndMerge(
          existingCollection.items,
          items,
        );
        for (let x = 0; x < existingCollection.items?.length; x++) {
          const newItem: CollectionItem[] = items.filter((item) => {
            return item.name === existingCollection.items[x].name;
          });
          //check on request level
          const mergedFolderRequests: CollectionItem[] = this.compareAndMerge(
            existingCollection.items[x].items,
            newItem[0]?.items || [],
          );
          mergedFolderItems[x].items = mergedFolderRequests;
        }
        items = mergedFolderItems;
        existingBranch = await this.collectionService.getActiveSyncedBranch(
          existingCollection._id.toString(),
          openApiDocument.info.title,
        );
        if (existingBranch) {
          branch = {
            insertedId: existingBranch.id,
            name: existingBranch.name,
          };
        } else {
          branch = await this.branchService.createBranch({
            name: openApiDocument.info.title,
            items: items,
          });
        }
        collection = {
          name: openApiDocument.info.title,
          description: openApiDocument.info.description,
          primaryBranch: primaryBranch ?? "",
          totalRequests,
          items: items,
          allBranches: [
            {
              id: branch.insertedId.toString(),
              name: openApiDocument.info.title,
            },
          ],
          uuid: openApiDocument.info.title,
          activeSync,
          activeSyncUrl: activeSyncUrl ?? "",
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: user.name,
          updatedBy: user.name,
        };
      } else {
        branch = await this.branchService.createBranch({
          name: openApiDocument.info.title,
          items: items,
        });
        collection = {
          name: openApiDocument.info.title,
          description: openApiDocument.info.description,
          primaryBranch: primaryBranch ?? "",
          totalRequests,
          items: items,
          allBranches: [
            {
              id: branch.insertedId.toString(),
              name: openApiDocument.info.title,
            },
          ],
          uuid: openApiDocument.info.title,
          activeSync,
          activeSyncUrl: activeSyncUrl ?? "",
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: user.name,
          updatedBy: user.name,
        };
      }
    } else {
      collection = {
        name: openApiDocument.info.title,
        description: openApiDocument.info.description,
        primaryBranch: primaryBranch ?? "",
        totalRequests,
        items: items,
        uuid: openApiDocument.info.title,
        activeSync,
        activeSyncUrl: activeSyncUrl ?? "",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: user.name,
        updatedBy: user.name,
      };
    }

    if (existingCollection) {
      await this.collectionService.updateImportedCollection(
        existingCollection._id.toString(),
        collection,
      );
      const updatedCollection = await this.collectionService.getCollection(
        existingCollection._id.toString(),
      );
      return {
        collection: updatedCollection,
        existingCollection: true,
      };
    }
    const newCollection = await this.collectionService.importCollection(
      collection,
    );
    const collectionDetails = await this.collectionService.getCollection(
      newCollection.insertedId.toString(),
    );
    collectionDetails;
    return {
      collection: collectionDetails,
      existingCollection: false,
    };
  }

  compareAndMerge(
    existingitems: CollectionItem[],
    newItems: CollectionItem[],
  ): CollectionItem[] {
    const newItemMap = newItems
      ? new Map(
          newItems.map((item) => [
            item.type === ItemTypeEnum.FOLDER
              ? item.name
              : item.name + item.request?.method,
            item,
          ]),
        )
      : new Map();
    const existingItemMap = existingitems
      ? new Map(
          existingitems.map((item) => [
            item.type === ItemTypeEnum.FOLDER
              ? item.name
              : item.name + item.request?.method,
            item,
          ]),
        )
      : new Map();
    // Merge old and new items while marking deleted
    const mergedArray: CollectionItem[] = existingitems.map((existingItem) => {
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
}
