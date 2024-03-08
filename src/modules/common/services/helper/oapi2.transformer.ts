import { v4 as uuidv4 } from "uuid";
import { ItemTypeEnum, SourceTypeEnum } from "../../models/collection.model";
import {
  OpenAPI20,
  OperationObject,
  ParameterObject,
  PathItemObject,
} from "../../models/openapi20.model";
import { TransformedRequest } from "../../models/collection.rxdb.model";
import { WithId } from "mongodb";
import { User } from "../../models/user.model";
import { buildExampleValue, getBaseUrl } from "./oapi3.transformer";

export function createCollectionItems(
  openApiDocument: OpenAPI20,
  user: WithId<User>,
) {
  const collectionItems: TransformedRequest[] = [];
  if (openApiDocument.definitions) {
    //Get all collection items
    for (const [pathName, pathObject] of Object.entries(
      openApiDocument.paths,
    )) {
      const request = transformPath(
        pathName,
        pathObject,
        openApiDocument.securityDefinitions,
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

function transformPath(
  pathName: string,
  pathObject: PathItemObject,
  security: any,
) {
  const transformedObject = {} as any;
  const method = Object.keys(pathObject)[0].toUpperCase(); // Assuming the first key is the HTTP method
  const pathItemObject: OperationObject = Object.values(pathObject)[0];
  transformedObject.tag = pathItemObject.tags
    ? pathItemObject.tags[0]
    : "default";

  transformedObject.name = pathName;
  transformedObject.description =
    pathItemObject.summary || pathItemObject.description || ""; // Use summary or description if available
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

  let consumes: any = null;
  if (pathItemObject.consumes) {
    consumes = Object.values(pathItemObject.consumes) || [];
    if (consumes.includes("application/json")) {
      transformedObject.request.body.raw = "";
      transformedObject.request.selectedRequestBodyType = "application/json";
    } else if (consumes.includes("application/javascript")) {
      transformedObject.request.body.raw = "";
      transformedObject.request.selectedRequestBodyType =
        "application/javascript";
    } else if (consumes.includes("text/html")) {
      transformedObject.request.body.raw = "";
      transformedObject.request.selectedRequestBodyType = "text/html";
    } else if (
      consumes.includes("application/xml") ||
      consumes.includes("text/xml")
    ) {
      transformedObject.request.body.raw = "";
      transformedObject.request.selectedRequestBodyType = "application/xml";
    } else if (consumes.includes("application/x-www-form-urlencoded")) {
      transformedObject.request.body.urlencoded = [];
      transformedObject.request.selectedRequestBodyType =
        "application/x-www-form-urlencoded";
    } else if (consumes.includes("multipart/form-data")) {
      transformedObject.request.body.formdata = {};
      transformedObject.request.selectedRequestBodyType = "multipart/form-data";
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
  for (const param of Object.values(parameters) as ParameterObject[]) {
    const paramIn = param.in;
    const paramName = param.name;
    const paramValue = param.example || getExampleValue(param.type); // Assuming example value is representative

    switch (paramIn) {
      case "body":
        if (consumes && consumes.includes("application/json")) {
          const schema = param.schema;
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
        }
        break;
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
      case "formData":
        if (
          consumes &&
          consumes.includes("application/x-www-form-urlencoded")
        ) {
          transformedObject.request.body.urlencoded.push({
            key: paramName,
            value: paramValue,
            checked: false,
          });
        } else if (consumes && consumes.includes("multipart/form-data")) {
          if (param.type === "file") {
            transformedObject.request.body.formdata.file = [];
            transformedObject.request.body.formdata.file.push({
              key: paramName,
              value: paramValue,
              checked: false,
              base: "#@#" + paramValue,
            });
          } else {
            transformedObject.request.body.formdata.text = [];
            transformedObject.request.body.formdata.text.push({
              key: paramName,
              value: paramValue,
              checked: false,
            });
          }
        }
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
