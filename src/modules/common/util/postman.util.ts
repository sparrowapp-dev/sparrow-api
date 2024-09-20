import {
  ItemTypeEnum,
  BodyModeEnum,
  AuthModeEnum,
  SourceTypeEnum,
  PostmanBodyModeEnum,
  SparrowCollection,
} from "@common/models/collection.model";
import { HTTPMethods } from "fastify";
import {
  TransformedRequest,
  AddTo,
  KeyValue,
  SparrowRequest,
  SparrowRequestBody,
} from "../models/collection.rxdb.model";

// Main function to convert Postman Collection to the new schema
export function convertPostmanToMySchema(
  postmanCollection: any,
): SparrowCollection {
  const { info, item: items } = postmanCollection;

  return {
    name: info.name,
    description: info.description || "",
    items: flattenItems(items),
    totalRequests: countTotalRequests(items),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function flattenItems(items: any[]): TransformedRequest[] {
  return items
    .flatMap((item) => convertItem(item))
    .filter(Boolean) as TransformedRequest[];
}

function countTotalRequests(items: any[]): number {
  return flattenItems(items).filter((i) => i.type === ItemTypeEnum.REQUEST)
    .length;
}

function convertItem(item: any): TransformedRequest[] {
  const collectionItems: TransformedRequest[] = [];
  const collectionItem: TransformedRequest = createCollectionItem(item);

  if (collectionItem.type === ItemTypeEnum.FOLDER) {
    collectionItem.items = flattenItems(item.item || []);
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

function createCollectionItem(item: any): TransformedRequest {
  return {
    name: item.name || "",
    description: item.description || "",
    type: item.item ? ItemTypeEnum.FOLDER : ItemTypeEnum.REQUEST,
    source: SourceTypeEnum.SPEC,
    request: null,
    items: item.item || [],
    createdBy: "user.name",
    updatedBy: "user.name",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function convertRequest(request: any): SparrowRequest {
  const body = request.body
    ? convertRequestBody(request.body)
    : createEmptyBody();

  return {
    method: request.method.toUpperCase() as HTTPMethods,
    url: request.url.raw,
    body,
    headers: convertParams(request.header),
    queryParams: convertParams(request.url.query),
    auth: createDefaultAuth(),
    selectedRequestBodyType: getRequestBodyType(request.body),
    selectedRequestAuthType: AuthModeEnum["No Auth"],
  };
}

function createEmptyBody(): SparrowRequestBody {
  return {
    raw: "",
    urlencoded: [],
    formdata: { text: [], file: [] },
  };
}

function createDefaultAuth(): any {
  return {
    bearerToken: "",
    basicAuth: { username: "", password: "" },
    apiKey: { authKey: "", authValue: "", addTo: AddTo.Header },
  };
}

function getRequestBodyType(body: any): BodyModeEnum | undefined {
  if (!body) return BodyModeEnum.none;

  let mode = body.mode;
  if (mode === "raw") {
    mode = body.options.raw.language;
  }
  // @ts-ignore
  return PostmanBodyModeEnum[mode];
}

function convertRequestBody(body: any): SparrowRequestBody {
  const requestBody: SparrowRequestBody = createEmptyBody();

  switch (body.mode.toLowerCase()) {
    case "raw":
      requestBody.raw = body.raw || "";
      break;

    case "formdata":
      requestBody.formdata = {
        text: filterAndMap(body.formdata, "text"),
        file: filterAndMap(body.formdata, "file"),
      };
      break;

    case "urlencoded":
      requestBody.urlencoded = mapKeyValuePairs(body.urlencoded);
      break;

    default:
      requestBody.raw = body.raw || "";
      break;
  }

  return requestBody;
}

function filterAndMap(data: any[], type: string): any[] {
  return (data || [])
    .filter((item) => item.type === type)
    .map((item) => ({
      key: item.key || "",
      value: type === "file" ? item.src || "" : item.value || "",
      checked: false,
      base: item.base || "",
    }));
}

function mapKeyValuePairs(data: any[]): KeyValue[] {
  return (data || []).map((item) => ({
    key: item.key || "",
    value: item.value || "",
    checked: false,
  }));
}

function convertParams(params: any[]): KeyValue[] {
  if (!params) return [];
  return params.map((param) => ({
    key: param.key || param.name || "",
    value: param.value || "",
    checked: false,
  }));
}

function isValidMethod(method: string): boolean {
  const validMethods = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);
  return validMethods.has(method.toUpperCase());
}
