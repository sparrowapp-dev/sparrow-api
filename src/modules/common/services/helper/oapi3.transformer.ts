import { v4 as uuidv4 } from "uuid";
import {
  AuthModeEnum,
  BodyModeEnum,
  ItemTypeEnum,
  SourceTypeEnum,
} from "../../models/collection.model";
import { OpenAPI20, SchemaRefObject } from "../../models/openapi20.model";
import {
  OpenAPI303,
  OperationObject,
  PathItemObject,
  Schema3RefObject,
} from "../../models/openapi303.model";
import { AddTo, TransformedRequest } from "../../models/collection.rxdb.model";
import { WithId } from "mongodb";
import { User } from "../../models/user.model";

export function createCollectionItems(
  openApiDocument: OpenAPI303,
  user: WithId<User>,
) {
  const collectionItems: TransformedRequest[] = [];

  for (const [pathName, pathObject] of Object.entries(openApiDocument.paths)) {
    const requests = transformPathV3(
      pathName,
      pathObject,
      openApiDocument.components.securitySchemes,
      user,
    );
    for (const requestObject of requests) {
      collectionItems.push({
        id: uuidv4(),
        name: requestObject.name,
        tag: requestObject.tag,
        type: ItemTypeEnum.REQUEST,
        description: requestObject.description,
        operationId: requestObject.operationId,
        source: SourceTypeEnum.SPEC,
        request: requestObject.request,
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
    if (!openApiDocument.tags) {
      openApiDocument.tags = [
        {
          name: "default",
          description: "This is a default folder",
        },
      ];
    }
    const itemTag = item.tag ?? "default";
    for (const tag of Object.values(openApiDocument?.tags)) {
      if (tag.name === itemTag) {
        tagDescription = tag.description;
      }
    }
    let folderObj = folderMap.get(itemTag);
    if (!folderObj) {
      folderObj = {};
      folderObj.name = itemTag;
      folderObj.description = tagDescription;
      folderObj.isDeleted = false;
      folderObj.source = SourceTypeEnum.SPEC;
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
  user: WithId<User>,
) {
  const transformedObjectArray: TransformedRequest[] = [];
  for (const [methodType, pathItemObjectType] of Object.entries(pathObject)) {
    const keyValueDefaultObj = {
      key: "",
      value: "",
      checked: false,
    };
    const formDataFileDefaultObj = {
      key: "",
      value: "",
      checked: false,
      base: "",
    };
    const transformedObject: TransformedRequest = {
      name: pathName || "",
      description: "",
      type: ItemTypeEnum.REQUEST,
      source: SourceTypeEnum.SPEC,
      request: {
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
        selectedRequestBodyType: BodyModeEnum["none"],
        selectedRequestAuthType: AuthModeEnum["No Auth"],
      },
      createdBy: user.name,
      updatedBy: user.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const method = methodType.toUpperCase();
    const pathItemObject: OperationObject = pathItemObjectType;
    transformedObject.tag = pathItemObject.tags
      ? pathItemObject.tags[0]
      : "default";
    transformedObject.name = pathName;
    transformedObject.description =
      pathItemObject.summary || pathItemObject.description || "";
    transformedObject.operationId = pathItemObject.operationId;
    transformedObject.request.method = method;

    // Extract URL path and query parameters
    const urlParts = pathName.split("/").filter((p) => p != "");
    let url = "";
    for (let i = 0; i < urlParts.length; i++) {
      if (urlParts[i].startsWith("{")) {
        url += "/{" + urlParts[i].slice(1, -1) + "}";
      } else {
        url += "/" + urlParts[i];
      }
      if (i + 1 < urlParts.length && urlParts[i + 1].includes("=")) {
        const queryParam = urlParts[i + 1].split("=");
        transformedObject.request.queryParams.push({
          key: queryParam[0],
          value: queryParam[1],
          checked: true,
        });
        i++;
      }
    }
    transformedObject.request.url = url;

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
          transformedObject.request.selectedRequestBodyType =
            BodyModeEnum["application/json"];
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
            BodyModeEnum["application/x-www-form-urlencoded"];
        }
        if (key === "application/octet-stream") {
          transformedObject.request.body.formdata.file.push({
            key: "file",
            value: "",
            checked: false,
            base: "#@#",
          });
          transformedObject.request.selectedRequestBodyType =
            BodyModeEnum["multipart/form-data"];
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
                  });
                }
              }
            }
          }
          transformedObject.request.selectedRequestBodyType =
            BodyModeEnum["multipart/form-data"];
        }
      }
    }

    if (security.api_key) {
      transformedObject.request.auth.apiKey.authKey = security.api_key.name;
      if (security.api_key.in === "header") {
        transformedObject.request.headers.push({
          key: security.api_key.name,
          value: "",
          checked: false,
        });
        transformedObject.request.auth.apiKey.addTo = AddTo.Header;
      } else if (security.api_key.in === "query") {
        transformedObject.request.queryParams.push({
          key: security.api_key.name,
          value: "",
          checked: false,
        });
        transformedObject.request.auth.apiKey.addTo = AddTo.QueryParameter;
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
      }
    }

    //Assign default values
    if (!transformedObject.request.headers.length) {
      transformedObject.request.headers.push(keyValueDefaultObj);
    }
    if (!transformedObject.request.queryParams.length) {
      transformedObject.request.queryParams.push(keyValueDefaultObj);
    }
    if (!transformedObject.request.body.formdata.text.length) {
      transformedObject.request.body.formdata.text.push(keyValueDefaultObj);
    }
    if (!transformedObject.request.body.formdata.file.length) {
      transformedObject.request.body.formdata.file.push(formDataFileDefaultObj);
    }
    if (!transformedObject.request.body.urlencoded.length) {
      transformedObject.request.body.urlencoded.push(keyValueDefaultObj);
    }
    transformedObjectArray.push(transformedObject);
  }

  return transformedObjectArray;
}

export function getExampleValue(exampleType: string) {
  switch (exampleType) {
    case "string":
      return "";
    case "number":
      return 0;
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
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
