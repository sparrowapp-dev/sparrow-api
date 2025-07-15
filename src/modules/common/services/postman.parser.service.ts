import { Injectable } from "@nestjs/common";

// ---- Model
import {
  Collection,
  CollectionAuthModeEnum,
} from "@common/models/collection.model";

// ---- Helpers
import {
  convertItems,
  countTotalRequests,
  flattenPostmanCollection,
} from "./helper/postman.parser";
import { DecodedUserObject } from "@src/types/fastify";

@Injectable()
export class PostmanParserService {
  constructor() {}
  /**
   * Parses a Postman Collection, converts the items, and enriches them with user information.
   * Then, it creates a collection object and flattens the collection before returning it.
   *
   * @param postmanCollection - The Postman Collection object to be parsed.
   * @returns The processed and flattened Postman Collection.
   */
  async parsePostmanCollection(
    postmanCollection: any,
    user: DecodedUserObject,
  ) {
    // Destructure the 'info' and 'item' properties from the Postman collection
    const { info, item: items } =
      postmanCollection.collection ?? postmanCollection;

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
      selectedAuthType: CollectionAuthModeEnum["No Auth"],
      totalRequests: countTotalRequests(items),
      createdBy: user?.name,
      updatedBy: {
        id: user?._id.toString() ?? "",
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
