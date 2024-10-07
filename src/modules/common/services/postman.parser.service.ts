import { Injectable } from "@nestjs/common";

// ---- Model
import { Collection } from "@common/models/collection.model";

// ---- Services
import { ContextService } from "./context.service";

// ---- Helpers
import {
  convertItems,
  countTotalRequests,
  flattenPostmanCollection,
} from "./helper/postman.parser";

@Injectable()
export class PostmanParserService {
  constructor(private readonly contextService: ContextService) {}
  /**
   * Parses a Postman Collection, converts the items, and enriches them with user information.
   * Then, it creates a collection object and flattens the collection before returning it.
   *
   * @param postmanCollection - The Postman Collection object to be parsed.
   * @returns The processed and flattened Postman Collection.
   */
  async parsePostmanCollection(postmanCollection: any) {
    const user = await this.contextService.get("user");

    // Destructure the 'info' and 'item' properties from the Postman collection
    const { info, item: items } = postmanCollection;

    // Convert the items of the Postman collection into a specific format
    // Majorly responsible for converting the folder and request structure of postman into Sparrow's structure
    let convertedItems = convertItems(items);
    convertedItems = convertedItems.map((item) => {
      item.createdBy = user?.name ?? "";
      items.updatedBy = user?.name ?? "";
      return item;
    });

    // Build the collection object with the parsed data and user information
    const collection: Collection = {
      name: info.name,
      description: info.description ?? "",
      items: convertedItems,
      totalRequests: countTotalRequests(items),
      createdBy: user?.name,
      updatedBy: {
        id: user?._id ?? "",
        name: user?.name ?? "",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Flatten the Postman collection to resolve nested folder issue and return the updated collection
    const updatedCollection = await flattenPostmanCollection(collection);
    return updatedCollection;
  }
}
