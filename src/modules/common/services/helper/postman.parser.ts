import {
  ItemTypeEnum,
  BodyModeEnum,
  AuthModeEnum,
  SourceTypeEnum,
  PostmanBodyModeEnum,
  CollectionItem,
  RequestMetaData,
} from "@common/models/collection.model";
import { HTTPMethods } from "fastify";
import {
  AddTo,
  KeyValue,
  SparrowRequestBody,
} from "../../models/collection.rxdb.model";
import { v4 as uuidv4 } from "uuid";

export function convertItems(items: any[]): CollectionItem[] {
  return items
    .flatMap((item) => convertItem(item))
    .filter(Boolean) as CollectionItem[];
}

export function countTotalRequests(items: any[]): number {
  return convertItems(items).filter((i: any) => i.type === ItemTypeEnum.REQUEST)
    .length;
}

function convertItem(item: any): CollectionItem[] {
  const collectionItems: CollectionItem[] = [];
  const collectionItem: CollectionItem = createCollectionItem(item);

  if (collectionItem.type === ItemTypeEnum.FOLDER) {
    collectionItem.items = convertItems(item.item || []);
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

function createCollectionItem(item: any): CollectionItem {
  return {
    id: uuidv4(),
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

function convertRequest(request: any): RequestMetaData {
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
    operationId: "",
    selectedRequestBodyType: getRequestBodyType(request.body, request.header),
    selectedRequestAuthType: AuthModeEnum["No Auth"],
  };
}

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

function createDefaultAuth(): any {
  return {
    bearerToken: "",
    basicAuth: { username: "", password: "" },
    apiKey: { authKey: "", authValue: "", addTo: AddTo.Header },
  };
}

function getRequestBodyType(body: any, headers: any): BodyModeEnum | undefined {
  let contentType = null;
  contentType = headers.find((header: any) => header.key === "Content-Type");
  if (!body && !contentType) return BodyModeEnum.none;

  let mode = body.mode;
  if (mode === "raw") {
    if (body.options) {
      mode = body.options.raw.language;
    } else {
      return contentType.value;
    }
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
  if (!params || !params.length)
    return [{ key: "", value: "", checked: false }];
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
