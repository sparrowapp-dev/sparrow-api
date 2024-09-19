import {
  Collection,
  ItemTypeEnum,
  BodyModeEnum,
  AuthModeEnum,
  SourceTypeEnum,
  PostmanBodyModeEnum,
} from "@common/models/collection.model";
import { HTTPMethods } from "fastify";
import {
  TransformedRequest,
  AddTo,
  KeyValue,
  SparrowRequest,
  SparrowRequestBody,
} from "../models/collection.rxdb.model";

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

function convertItem(item: any): TransformedRequest[] {
  const collectionItems: TransformedRequest[] = [];
  const requestObj: SparrowRequest = {
    method: "",
    url: "",
    body: {
      raw: "",
      urlencoded: [],
      formdata: {
        text: [],
        file: [],
      },
    },
    headers: [],
    queryParams: [],
    auth: {
      bearerToken: "",
      basicAuth: {
        username: "",
        password: "",
      },
      apiKey: {
        authKey: "",
        authValue: "",
        addTo: AddTo.Header,
      },
    },
    selectedRequestBodyType: BodyModeEnum.none,
    selectedRequestAuthType: AuthModeEnum["No Auth"],
  };
  const collectionItem: TransformedRequest = {
    name: item.name || "",
    description: item.description || "",
    type: item.item ? ItemTypeEnum.FOLDER : ItemTypeEnum.REQUEST,
    source: SourceTypeEnum.SPEC,
    request: item.item ? null : requestObj,
    items: item.item || [],
    createdBy: "user.name",
    updatedBy: "user.name",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (collectionItem.type === ItemTypeEnum.FOLDER) {
    collectionItem.items
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

function convertRequest(request: any): SparrowRequest {
  const emptyBody: SparrowRequestBody = {
    raw: "",
    urlencoded: [],
    formdata: {
      text: [],
      file: [],
    },
  };
  const requestMetaData: SparrowRequest = {
    method: "",
    url: "",
    body: emptyBody,
    headers: [],
    queryParams: [],
    auth: {
      bearerToken: "",
      basicAuth: {
        username: "",
        password: "",
      },
      apiKey: {
        authKey: "",
        authValue: "",
        addTo: AddTo.Header,
      },
    },
    selectedRequestBodyType: BodyModeEnum["none"],
    selectedRequestAuthType: AuthModeEnum["No Auth"],
  };
  requestMetaData.method = request.method.toUpperCase() as HTTPMethods;
  requestMetaData.url = request.url.raw;
  requestMetaData.body = request.body
    ? convertRequestBody(request.body)
    : emptyBody;

  if (request.body) {
    requestMetaData.selectedRequestBodyType = getRequestBodyType(request.body);
  }

  requestMetaData.selectedRequestAuthType = AuthModeEnum["No Auth"];
  requestMetaData.queryParams = convertParams(request.url.query);
  // requestMetaData.pathParams = convertParams(request.url.path);
  requestMetaData.headers = convertParams(request.header);
  return requestMetaData;
}

// @ts-ignore
function getRequestBodyType(body) {
  let mode = body.mode;
  if (mode === "raw") {
    mode = body.options.raw.language;
  }
  // @ts-ignore
  return PostmanBodyModeEnum[mode];
}

// Utility function to convert Postman request body to Sparrow schema
function convertRequestBody(body: any): SparrowRequestBody {
  const requestBody: SparrowRequestBody = {};

  switch (body.mode.toLowerCase()) {
    case "raw":
      requestBody.raw = body.raw || "";
      break;

    case "formdata":
      requestBody.formdata = {
        text: (body.formdata || [])
          .filter((item: any) => item.type === "text")
          .map((item: any) => ({
            key: item.key || "",
            value: item.value || "",
            checked: item.type === "text" ? false : true,
          })),
        file: (body.formdata || [])
          .filter((item: any) => item.type === "file")
          .map((item: any) => ({
            key: item.key || "",
            value: item.src || "",
            checked: false,
            base: item.base || "",
          })),
      };
      break;

    case "urlencoded":
      requestBody.urlencoded = (body.urlencoded || []).map((item: any) => ({
        key: item.key || "",
        value: item.value || "",
        checked: false,
      }));
      break;

    default:
      requestBody.raw = body.raw || "";
      break;
  }

  return requestBody;
}
function convertParams(params: any[]): KeyValue[] {
  if (!params) return [];
  return params.map((param: any) => ({
    key: param.key || param.name || "",
    value: param.value || "",
    checked: false,
  }));
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
