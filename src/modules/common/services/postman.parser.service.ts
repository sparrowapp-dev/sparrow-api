import { Collection } from "@common/models/collection.model";
import { Injectable } from "@nestjs/common";
import { ContextService } from "./context.service";
import { WithId } from "mongodb";
import { CollectionService } from "@src/modules/workspace/services/collection.service";
import { convertItems, countTotalRequests } from "./helper/postman.parser";

@Injectable()
export class PostmanParserService {
  constructor(
    private readonly contextService: ContextService,
    private readonly collectionService: CollectionService,
  ) {}
  async parsePostmanCollection(postmanCollection: any): Promise<{
    collection: WithId<Collection>;
  }> {
    const user = await this.contextService.get("user");
    const { info, item: items } = postmanCollection;
    let convertedItems = convertItems(items);
    convertedItems = convertedItems.map((item) => {
      item.createdBy = user.name;
      items.updatedBy = user.name;
      return item;
    });
    const collection: Collection = {
      name: info.name,
      description: info.description || "",
      items: convertedItems,
      totalRequests: countTotalRequests(items),
      createdBy: user.name,
      updatedBy: {
        id: user._id,
        name: user.name,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const newCollection = await this.collectionService.importCollection(
      collection,
    );
    const collectionDetails = await this.collectionService.getCollection(
      newCollection.insertedId.toString(),
    );
    return {
      collection: collectionDetails,
    };
  }
}
