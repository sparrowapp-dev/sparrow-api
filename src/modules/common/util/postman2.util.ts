import {
  Collection,
  CollectionItem,
  ItemTypeEnum,
  RequestBody,
  Params,
  WebSocketBodyModeEnum,
  QueryParams,
} from "@common/models/collection.model";
import { HTTPMethods } from "fastify";

export function convertPostmanToSparrow(postmanCollection: any): Collection {
  // Initialize the base Sparrow collection
  const sparrowCollection: Collection = {
    name: postmanCollection.info.name,
    description: postmanCollection.info.description || null,
    totalRequests: 0,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Helper function to process a folder (handling nested folder names)
  const processFolder = (
    folder: any,
    prefix: string = "",
  ): CollectionItem[] => {
    const items: CollectionItem[] = [];

    folder.item.forEach((item: any) => {
      if (item.item) {
        // This is a folder, so process its items with a nested name prefix
        const nestedItems = processFolder(item, `${prefix}${item.name}/`);
        items.push(...nestedItems); // Add nested items directly to the top-level
      } else {
        // This is a request, so process it
        const requestItem = processRequest(item, prefix);
        if (requestItem) items.push(requestItem); // Only add supported requests
      }
    });

    return items;
  };

  // Helper function to process individual requests
  const processRequest = (item: any, prefix: string): CollectionItem | null => {
    const method = item.request.method.toUpperCase();
    if (["GET", "PUT", "POST", "PATCH", "DELETE"].includes(method)) {
      // Handle HTTP methods
      return {
        id: null,
        name: `${prefix}${item.name}`,
        description: item.request.description || null,
        type: ItemTypeEnum.REQUEST,
        request: {
          method: method as HTTPMethods,
          operationId: item.name,
          url: item.request.url.raw,
          body: item.request.body ? [convertBody(item.request.body)] : [],
          queryParams: item.request.url.query.map(convertQueryParam),
          headers: item.request.header.map(convertHeader),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "system",
        updatedBy: "system",
      };
    } else if (method === "WEBSOCKET") {
      // Handle WebSocket requests
      return {
        id: null,
        name: `${prefix}${item.name}`,
        description: item.request.description || null,
        type: ItemTypeEnum.WEBSOCKET,
        websocket: {
          url: item.request.url.raw,
          message: item.request.body?.message || null,
          selectedWebSocketBodyType:
            item.request.body?.mode || WebSocketBodyModeEnum.none,
          queryParams: item.request.url.query.map(convertQueryParam),
          headers: item.request.header.map(convertHeader),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "system",
        updatedBy: "system",
      };
    }
    // Skip unsupported methods
    return null;
  };

  // Conversion helpers for body, query params, and headers
  const convertBody = (body: any): RequestBody => {
    return {
      type: body.mode,
      schema: body.raw ? JSON.parse(body.raw) : null, // Assuming raw schema is JSON
    };
  };

  const convertQueryParam = (param: any): QueryParams => {
    return {
      key: param.key,
      value: param.value,
    };
  };

  const convertHeader = (header: any): Params => {
    return {
      name: header.key,
      description: header.description || "",
      required: header.disabled === false, // Treat disabled headers as optional
      schema: {}, // No schema in Postman headers, leave it empty
    };
  };

  // Process the top-level collection items
  postmanCollection.item.forEach((item: any) => {
    if (item.item) {
      // It's a folder, process its items
      const folderItems = processFolder(item);
      sparrowCollection.items.push(...folderItems);
    } else {
      // It's a request, process directly
      const requestItem = processRequest(item, "");
      if (requestItem) sparrowCollection.items.push(requestItem);
    }
  });

  // Set totalRequests count
  sparrowCollection.totalRequests = sparrowCollection.items.length;

  return sparrowCollection;
}
