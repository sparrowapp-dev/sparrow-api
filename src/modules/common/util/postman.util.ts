import {
  Collection,
  CollectionItem,
  ItemTypeEnum,
  RequestMetaData,
  BodyModeEnum,
  AuthModeEnum,
  RequestBody,
  Params,
} from "@common/models/collection.model";
import { HTTPMethods } from "fastify";

// Utility function to convert Postman Collection to the new schema
export function convertPostmanToMySchema(postmanCollection: any): Collection {
  const collection = new Collection();
  collection.name = postmanCollection.info.name;
  collection.description = postmanCollection.info.description || "";
  collection.items = (postmanCollection.item || []).flatMap((item: any) =>
    convertItem(item),
  );
  collection.totalRequests = collection.items.filter(
    (i) => i.type === ItemTypeEnum.REQUEST,
  ).length;
  collection.createdAt = new Date();
  collection.updatedAt = new Date();
  return collection;
}

function convertItem(item: any): CollectionItem[] {
  const collectionItems: CollectionItem[] = [];

  const collectionItem = new CollectionItem();
  collectionItem.name = item.name;
  collectionItem.description = item.description || "";
  collectionItem.type = item.item ? ItemTypeEnum.FOLDER : ItemTypeEnum.REQUEST;
  collectionItem.createdAt = new Date();
  collectionItem.updatedAt = new Date();

  if (collectionItem.type === ItemTypeEnum.FOLDER) {
    collectionItem.items = (item.item || [])
      .filter((subItem: any) => !subItem.item)
      .flatMap((subItem: any) => convertItem(subItem));
    collectionItems.push(collectionItem);
  } else if (
    collectionItem.type === ItemTypeEnum.REQUEST &&
    isValidMethod(item.request.method)
  ) {
    collectionItem.request = convertRequest(item.request);
    collectionItems.push(collectionItem);
  }

  return collectionItems;
}

function convertRequest(request: any): RequestMetaData {
  const requestMetaData = new RequestMetaData();
  requestMetaData.method = request.method.toUpperCase() as HTTPMethods;
  requestMetaData.operationId = request.url.raw;
  requestMetaData.url = request.url.raw;
  requestMetaData.body = request.body ? [convertRequestBody(request.body)] : [];
  requestMetaData.selectedRequestBodyType = request.body
    ? BodyModeEnum[request.body.mode.toUpperCase() as keyof typeof BodyModeEnum]
    : BodyModeEnum.none;
  requestMetaData.selectedRequestAuthType = AuthModeEnum["No Auth"];
  requestMetaData.queryParams = convertParams(request.url.query);
  requestMetaData.pathParams = convertParams(request.url.path);
  requestMetaData.headers = convertParams(request.header);
  return requestMetaData;
}

function convertRequestBody(body: any): RequestBody {
  const requestBody = new RequestBody();
  requestBody.type =
    BodyModeEnum[body.mode.toUpperCase() as keyof typeof BodyModeEnum];
  requestBody.schema = body[body.mode]; // Assuming body mode key has the actual body schema
  return requestBody;
}

function convertParams(params: any[]): Params[] {
  if (!params) return [];
  return params.map((param) => {
    const p = new Params();
    p.name = param.key || param.name;
    p.description = param.description || "";
    p.required = param.required || false;
    p.schema = {}; // Assuming an empty schema object
    return p;
  });
}

function isValidMethod(method: string): boolean {
  const validMethods: Set<string> = new Set([
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
  ]);
  return validMethods.has(method.toUpperCase());
}
