/* eslint-disable @typescript-eslint/ban-ts-comment */

// ---- Libraries
import { HTTPMethods } from "fastify";
import { v4 as uuidv4 } from "uuid";

// ---- Model
import {
  ItemTypeEnum,
  BodyModeEnum,
  SourceTypeEnum,
  PostmanBodyModeEnum,
  CollectionItem,
  RequestMetaData,
  PostmanAuthModeEnum,
} from "@common/models/collection.model";
import {
  AddTo,
  KeyValue,
  SparrowRequestBody,
} from "../../models/collection.rxdb.model";

/**
 * Converts an array of Postman items into an array of CollectionItem(items of sparrow).
 *
 * @param items - Array of items from Postman collection.
 * @returns Converted collection items.
 */
export function convertItems(items: any[]): CollectionItem[] {
  const data = items
    .flatMap((item) => convertItem(item)) // Converts each item.
    .filter(Boolean) as CollectionItem[];
  return data;
}

/**
 * Flattens a Postman collection by processing folders and requests.
 * Requests inside nested folders are flattened with the folder names prepended.
 *
 * @param collection - The Postman collection object to be flattened.
 * @returns The flattened collection with updated items.
 */
export function flattenPostmanCollection(collection: any) {
  const flattenedItems: any[] = [];

  // Helper function to process folders recursively
  function processFolder(
    folder: any,
    parentFolderName = "",
    isFirstLevel = true,
  ) {
    const currentFolder = {
      ...folder,
      items: [], // Initialize the items array
    };

    folder.items.forEach((item: any) => {
      if (item.type === "FOLDER") {
        if (isFirstLevel) {
          // Keep the first-level folder intact and process its contents
          currentFolder.items.push(...processFolder(item, item.name, false));
        } else {
          // Flatten nested folders by adding their requests with parent folder names prepended
          currentFolder.items.push(
            ...processFolder(item, `${parentFolderName}/${item.name}`, false),
          );
        }
      } else if (item.type === "REQUEST") {
        // Prepend folder names to request name
        const newItem = {
          ...item,
          name: parentFolderName
            ? `${parentFolderName}/${item.name}`
            : item.name,
        };
        currentFolder.items.push(newItem);
      }
    });

    // Return the current folder's items if it's a nested folder, or the folder itself if it's first level
    return isFirstLevel ? [currentFolder] : currentFolder.items;
  }

  // Process top-level folders or requests
  collection.items.forEach((item: any) => {
    if (item.type === "FOLDER") {
      flattenedItems.push(...processFolder(item, "", true)); // Process top-level folders
    } else if (item.type === "REQUEST") {
      flattenedItems.push(item); // Directly add top-level requests
    }
  });

  // Return a new collection with the updated flattened items
  return {
    ...collection,
    items: flattenedItems,
  };
}

/**
 * Counts the total number of requests in the given collection items.
 *
 * @param items - Array of items (requests and folders).
 * @returns The total number of requests.
 */
export function countTotalRequests(items: any[]): number {
  return convertItems(items).filter((i: any) => i.type === ItemTypeEnum.REQUEST)
    .length;
}

/**
 * Converts an individual item into a `CollectionItem` and processes nested items if it's a folder.
 *
 * @param item - The item from Postman collection.
 * @returns An array of converted collection items.
 */
function convertItem(item: any): CollectionItem[] {
  const collectionItems: CollectionItem[] = [];
  const collectionItem: CollectionItem = createCollectionItem(item);

  if (collectionItem.type === ItemTypeEnum.FOLDER) {
    // Recursively convert folder items
    collectionItem.items = convertItems(item.item || []);
    collectionItems.push(collectionItem);
  } else if (
    collectionItem.type === ItemTypeEnum.REQUEST &&
    isValidMethod(item.request.method)
  ) {
    // Convert request data and add to collection items
    collectionItem.request = convertRequest(item.request);
    collectionItems.push(collectionItem);
  }

  return collectionItems;
}

/**
 * Creates a `CollectionItem` object with initial values.
 *
 * @param item - The item to be converted.
 * @returns The initialized collection item.
 */
function createCollectionItem(item: any): CollectionItem {
  return {
    id: uuidv4(),
    name: item.name || "",
    description: item.description || "",
    type: item.item ? ItemTypeEnum.FOLDER : ItemTypeEnum.REQUEST,
    source: SourceTypeEnum.SPEC,
    request: null,
    items: item.item || [],
    createdBy: "",
    updatedBy: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Converts a Postman request into a RequestMetaData(Sparrow request format).
 *
 * @param request - The Postman request object.
 * @returns Converted request metadata.
 */
function convertRequest(request: any): RequestMetaData {
  const body = request.body
    ? convertRequestBody(request.body)
    : createEmptyBody();

  return {
    method: request.method.toUpperCase() as HTTPMethods,
    url: request?.url?.raw ?? "",
    body,
    headers: convertParams(request.header), // Convert headers to key-value pairs
    queryParams: convertParams(request?.url?.query ?? []), // Convert query params
    auth: convertAuth(request?.auth), // Converts auth params
    operationId: "",
    selectedRequestBodyType: getRequestBodyType(request.body, request.header),
    selectedRequestAuthType:
      // @ts-ignore
      PostmanAuthModeEnum[request?.auth?.type || "noauth"],
  };
}

/**
 * Creates an empty request body with default structure.
 *
 * @returns The empty request body.
 */
function createEmptyBody(): SparrowRequestBody {
  return {
    raw: "",
    urlencoded: [{ key: "", value: "", checked: false }],
    formdata: {
      text: [{ key: "", value: "", checked: false }],
      file: [],
    },
  };
}

/**
 * Convert Postman authentication object into Sparrow auth structure.
 *
 * @param auth - The Postman auth object.
 * @returns Sparrow Auth Object.
 */
function convertAuth(auth: any): any {
  return {
    bearerToken: auth?.bearer ? auth?.bearer[0]?.value : "",
    basicAuth: auth?.basic
      ? { username: auth?.basic[1]?.value, password: auth?.basic[0]?.value }
      : { username: "", password: "" },
    apiKey: auth?.apikey
      ? {
          authKey: auth?.apikey[1]?.value,
          authValue: auth?.apikey[0]?.value,
          addTo:
            auth?.apikey?.length === 2 ? AddTo.Header : AddTo.QueryParameter,
        }
      : { authKey: "", authValue: "", addTo: AddTo.Header },
  };
}

/**
 * Determines the type of the request body based on its mode and headers.
 *
 * @param body - The Postman request body object.
 * @param headers - The Postman request headers.
 * @returns The body type (if any).
 */
function getRequestBodyType(body: any, headers: any): BodyModeEnum | undefined {
  let contentType = null;
  contentType = headers.find((header: any) => header.key === "Content-Type");
  if (!body && !contentType) return BodyModeEnum.none;

  if (body) {
    let mode = body.mode;
    if (mode === "raw") {
      if (body.options) {
        mode = body.options.raw.language;
      }
    }
    // @ts-ignore
    return PostmanBodyModeEnum[mode];
  }
  return contentType.value;
}

/**
 * Converts the Postman request body to SparrowRequestBody(Sparrow Request format) as per body mode.
 *
 * @param body - The Postman request body.
 * @returns The converted request body.
 */
function convertRequestBody(body: any): SparrowRequestBody {
  const requestBody: SparrowRequestBody = createEmptyBody();

  switch (body.mode.toLowerCase()) {
    case "raw":
      requestBody.raw = body.raw || ""; // Handle raw mode
      break;

    case "formdata":
      requestBody.formdata = {
        text: filterAndMap(body.formdata, "text"), // Map form data for text fields
        file: [], // Map form data for file fields
      };
      break;

    case "urlencoded":
      requestBody.urlencoded = mapKeyValuePairs(body.urlencoded); // Handle urlencoded mode
      break;

    default:
      requestBody.raw = body.raw || "";
      break;
  }

  return requestBody;
}

/**
 * Filters and maps form data to key-value pairs based on the type (text or file).
 *
 * @param formData - The form data array.
 * @param type - The type of form data (either "text" or "file").
 * @returns Filtered and mapped key-value pairs or file data.
 */
function filterAndMap(data: any[], type: string): any[] {
  const result = (data || [])
    // .filter((item) => item.type === type)
    .map((item) => ({
      key: item.key || "",
      value: type === "file" ? "" : item.value || "",
      checked: false,
    }));

  // Push empty key-value pair at the end
  result.push({
    key: "",
    value: "",
    checked: false,
  });

  return result;
}

/**
 * Maps Postman urlencoded parameters into key-value pairs.
 *
 * @param params - Array of Postman urlencoded parameters.
 * @returns Mapped key-value pairs.
 */
function mapKeyValuePairs(data: any[]): KeyValue[] {
  const result = (data || []).map((item) => ({
    key: item.key || "",
    value: item.value || "",
    checked: false,
  }));

  // Push an empty key-value pair
  result.push({
    key: "",
    value: "",
    checked: false,
  });

  return result;
}

/**
 * Converts Postman headers or query parameters into key-value pairs of sparrow format.
 *
 * @param params - Array of Postman headers or query parameters.
 * @returns Converted key-value pairs.
 */
function convertParams(params: any[]): KeyValue[] {
  if (!params || !params.length)
    return [{ key: "", value: "", checked: false }];
  const convertedParams = (params || [])
    .filter((param) => (param.key || param.name) !== "" && param.value !== "")
    .map((param) => ({
      key: param.key || param.name || "",
      value: param.value || "",
      checked: false,
    }));
  // Pushed extra empty key values.
  convertedParams.push({
    key: "",
    value: "",
    checked: false,
  });
  return convertedParams;
}

/**
 * Checks if the given HTTP method is valid.
 *
 * @param method - HTTP method to check.
 * @returns True if the method is valid, otherwise false.
 */
function isValidMethod(method: string): boolean {
  const validMethods = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);
  return validMethods.has(method.toUpperCase());
}
