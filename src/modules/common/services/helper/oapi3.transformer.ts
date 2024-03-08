import { v4 as uuidv4 } from "uuid";
import { ItemTypeEnum, SourceTypeEnum } from "../../models/collection.model";
import { OpenAPI20, SchemaRefObject } from "../../models/openapi20.model";
import {
  OpenAPI303,
  OperationObject,
  PathItemObject,
  Schema3RefObject,
} from "../../models/openapi303.model";
import { TransformedRequest } from "../../models/collection.rxdb.model";
import { WithId } from "mongodb";
import { User } from "../../models/user.model";

export function createCollectionItems(
  openApiDocument: OpenAPI303,
  user: WithId<User>,
) {
  const collectionItems: TransformedRequest[] = [];

  if (openApiDocument.components) {
    for (const [pathName, pathObject] of Object.entries(
      openApiDocument.paths,
    )) {
      const request = transformPathV3(
        pathName,
        pathObject,
        openApiDocument.components.securitySchemes,
      );
      collectionItems.push({
        id: uuidv4(),
        name: request.name,
        tag: request.tag,
        type: ItemTypeEnum.REQUEST,
        description: request.description,
        operationId: request.operationId,
        source: SourceTypeEnum.SPEC,
        request: request.request,
        isDeleted: false,
        createdBy: user.name,
        updatedBy: user.name,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const baseUrl = getBaseUrl(openApiDocument);

  //Assigning requests to folders according to their tag
  const folderMap = new Map();
  for (const item of collectionItems) {
    item.request.url = baseUrl + item.request.url;
    let tagDescription = "";
    for (const tag of Object.values(openApiDocument?.tags)) {
      if (tag.name === item.tag) {
        tagDescription = tag.description;
      }
    }
    let folderObj = folderMap.get(item.tag);
    if (!folderObj) {
      folderObj = {};
      folderObj.name = item.tag;
      folderObj.description = tagDescription;
      folderObj.isDeleted = false;
      folderObj.type = ItemTypeEnum.FOLDER;
      folderObj.id = uuidv4();
      folderObj.items = [];
    }
    delete item.tag;
    folderObj.items.push(item);
    folderMap.set(folderObj.name, folderObj);
  }
  return folderMap;
}

function transformPathV3(
  pathName: string,
  pathObject: PathItemObject,
  security: any,
) {
  const transformedObject = {} as any;
  const method = Object.keys(pathObject)[0].toUpperCase();
  const pathItemObject: OperationObject = Object.values(pathObject)[0];
  transformedObject.tag = pathItemObject.tags
    ? pathItemObject.tags[0]
    : "default";
  transformedObject.name = pathName;
  transformedObject.description =
    pathItemObject.summary || pathItemObject.description || "";
  transformedObject.operationId = pathItemObject.operationId;
  transformedObject.request = {};
  transformedObject.request.method = method;

  // Extract URL path and query parameters
  const urlParts = pathName.split("/").filter((p) => p != "");
  let url = "";
  const queryParams = [] as any;
  for (let i = 0; i < urlParts.length; i++) {
    if (urlParts[i].startsWith("{")) {
      url += "/{" + urlParts[i].slice(1, -1) + "}";
    } else {
      url += "/" + urlParts[i];
    }
    if (i + 1 < urlParts.length && urlParts[i + 1].includes("=")) {
      const queryParam = urlParts[i + 1].split("=");
      queryParams.push({
        key: queryParam[0],
        value: queryParam[1],
        checked: true,
      });
      i++;
    }
  }
  transformedObject.request.url = url;
  transformedObject.request.queryParams = queryParams;
  transformedObject.request.pathParams = [];

  // Handle request body based on schema
  transformedObject.request.body = {};
  transformedObject.request.body.raw = "";
  transformedObject.request.body.formdata = {};
  transformedObject.request.body.formdata.file = [];
  transformedObject.request.body.formdata.text = [];
  transformedObject.request.body.urlencoded = [];

  const content = pathItemObject?.requestBody?.content;
  if (content) {
    const contentKeys = Object.keys(pathItemObject.requestBody.content) || [];
    for (const key of contentKeys) {
      if (key === "application/json") {
        const schema = content[key].schema;
        if (schema && schema.type === "object") {
          const properties = schema.properties || {};
          const bodyObject: any = {};
          for (const [propertyName, property] of Object.entries(properties)) {
            const exampleType = property.type;
            const exampleValue = property.example;
            bodyObject[propertyName] =
              exampleValue ||
              buildExampleValue(property) ||
              getExampleValue(exampleType);
          }
          transformedObject.request.body.raw = JSON.stringify(bodyObject);
        }
        transformedObject.request.selectedRequestBodyType = "application/json";
      }
      if (key === "application/x-www-form-urlencoded") {
        const schema = content[key].schema;
        if (schema && schema.type === "object") {
          const properties = schema.properties || {};
          for (const [propertyName, property] of Object.entries(properties)) {
            const exampleType = property.type;
            const exampleValue = property.example; // Use example if available
            transformedObject.request.body.urlencoded.push({
              key: propertyName,
              value:
                exampleValue ||
                buildExampleValue(property) ||
                getExampleValue(exampleType),
              checked: false,
            });
          }
        }
        transformedObject.request.selectedRequestBodyType =
          "application/x-www-form-urlencoded";
      }
      if (key === "application/octet-stream") {
        transformedObject.request.body.formdata.file = [];
        transformedObject.request.body.formdata.file.push({
          key: "file",
          value: "",
          checked: false,
          base: "#@#",
        });
        transformedObject.request.selectedRequestBodyType =
          "multipart/form-data";
      }
      if (key === "multipart/form-data") {
        const schema = content[key].schema;
        if (schema && schema.type === "object") {
          const properties = schema.properties || {};
          for (const [propertyName, property] of Object.entries(properties)) {
            if (property.type === "string" || property.type === "object") {
              if (property.format === "binary") {
                transformedObject.request.body.formdata.file.push({
                  key: propertyName,
                  value: "",
                  checked: false,
                  base: "#@#" + "",
                });
              } else {
                transformedObject.request.body.formdata.text.push({
                  key: propertyName,
                  value: getExampleValue(property.format),
                  checked: false,
                  base: "#@#" + "",
                });
              }
            }
          }
        }
        transformedObject.request.selectedRequestBodyType =
          "multipart/form-data";
      }
    }
  }

  // Handle headers based on schema
  transformedObject.request.headers = [];

  // Handle authentication based on schema
  transformedObject.request.auth = {};

  if (security.api_key) {
    transformedObject.request.auth = {
      apiKey: {
        authKey: security.api_key.name,
        authValue: "",
        addTo: "",
      },
    };
    if (security.api_key.in === "header") {
      transformedObject.request.headers.push({
        key: security.api_key.name,
        value: "",
        checked: false,
      });
      transformedObject.request.auth.apiKey.addTo = "Header";
    } else if (security.api_key.in === "query") {
      transformedObject.request.queryParams.push({
        key: security.api_key.name,
        value: "",
        checked: false,
      });
      transformedObject.request.auth.apiKey.addTo = "Query Parameters";
    }
  }

  // Parse request body parameters
  const parameters = pathItemObject.parameters || [];
  for (const param of Object.values(parameters)) {
    const paramIn = param.in;
    const paramName = param.name;
    const paramValue = param.example || getExampleValue(param.type);

    switch (paramIn) {
      case "header":
        transformedObject.request.headers.push({
          key: paramName,
          value: paramValue,
          checked: true,
        });
        break;
      case "query":
        transformedObject.request.queryParams.push({
          key: paramName,
          value: paramValue,
          checked: false,
        });
        break;
      case "path":
        transformedObject.request.pathParams.push({
          key: paramName,
          value: paramValue,
          checked: false,
        });
        break;
    }
  }

  return transformedObject;
}

function getExampleValue(exampleType: string) {
  switch (exampleType) {
    case "string":
      return ""; // Or a default string value
    case "number":
      return 0; // Or a default number value
    case "integer":
      return 0; // Or a default number value
    case "boolean":
      return false; // Or a default boolean value
    case "array":
      return []; // Empty array
    case "object":
      return {}; // Empty object
    default:
      return ""; // Or a generic default value
  }
}

export function buildExampleValue(
  property: Schema3RefObject | SchemaRefObject,
) {
  if (property.type === "object") {
    const nestedProperties = property.properties || {};
    const nestedObject: any = {};
    for (const [nestedPropertyName, nestedProperty] of Object.entries(
      nestedProperties,
    )) {
      nestedObject[nestedPropertyName] = buildExampleValue(nestedProperty);
    }
    return nestedObject;
  } else {
    return property.example || getExampleValue(property.type);
  }
}

export function getBaseUrl(openApiDocument: OpenAPI20 | OpenAPI303) {
  const basePath = openApiDocument.basePath ? openApiDocument.basePath : "";
  if (openApiDocument.host) {
    return "https://" + openApiDocument.host + basePath;
  } else {
    return "http://localhost:{{PORT}}" + basePath;
  }
}
