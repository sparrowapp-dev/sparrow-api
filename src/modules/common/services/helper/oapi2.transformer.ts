// @ts-nocheck
import { v4 as uuidv4 } from "uuid";
import { ItemTypeEnum, SourceTypeEnum } from "../../models/collection.model";

export function createCollectionItems(openApiDocument, user) {
  const collectionItems = [];

  //Get all collection items
  for (const [pathName, pathObject] of Object.entries(openApiDocument.paths)) {
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

function transformPath(pathName: string, pathObject: any, security: any) {
  const transformedObject = {} as any;
  const method = Object.keys(pathObject)[0].toUpperCase(); // Assuming the first key is the HTTP method
  pathObject = Object.values(pathObject)[0];
  transformedObject.tag = pathObject.tags ? pathObject.tags[0] : "default";

  transformedObject.name = pathName;
  transformedObject.description =
    pathObject.summary || pathObject.description || ""; // Use summary or description if available
  transformedObject.operationId = pathObject.operationId;

  transformedObject.request = {};

  transformedObject.request.method = method;

  // Extract URL path and query parameters
  const urlParts = pathName.split("/").filter((p) => p != "");
  let url = "";
  const queryParams = [] as any;
  for (let i = 0; i < urlParts.length; i++) {
    if (urlParts[i].startsWith("{")) {
      url += "/{" + urlParts[i].slice(1, -1) + "}"; // Replace path parameter with placeholder
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
      i++; // Skip the next part as it's already processed as query param
    }
  }
  transformedObject.request.url = url;
  transformedObject.request.queryParams = queryParams;

  transformedObject.request.pathParams = [];

  // Handle request body based on schema
  transformedObject.request.body = {};
  let consumes: any = null;
  if (pathObject.consumes) {
    consumes = Object.values(pathObject.consumes) || [];
    if (consumes.includes("application/json")) {
      transformedObject.request.body.raw = ""; // Placeholder for raw JSON body
      transformedObject.request.selectedRequestBodyType = "application/json";
    } else if (consumes.includes("application/x-www-form-urlencoded")) {
      transformedObject.request.body.urlencoded = []; // Array for form-urlencoded data
      transformedObject.request.selectedRequestBodyType =
        "application/x-www-form-urlencoded";
    } else if (consumes.includes("multipart/form-data")) {
      transformedObject.request.body.formdata = {}; // Text and file data for multipart form data
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
  const parameters = pathObject.parameters || [];
  for (const param of Object.values(parameters)) {
    const paramIn = param.in;
    const paramName = param.name;
    const paramValue = param.example || getExampleValue(param.type); // Assuming example value is representative

    switch (paramIn) {
      case "body":
        if (consumes && consumes.includes("application/json")) {
          const schema = param.schema;
          if (schema && schema.type === "object") {
            const properties = schema.properties || {};
            const bodyObject = {};
            for (const [propertyName, property] of Object.entries(properties)) {
              const exampleType = property.type;
              const exampleValue = property.example; // Use example if available
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

function getExampleValue(exampleType) {
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

function buildExampleValue(property) {
  if (property.type === "object") {
    const nestedProperties = property.properties || {};
    const nestedObject = {};
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

function getBaseUrl(openApiDocument) {
  const basePath = openApiDocument.basePath ? openApiDocument.basePath : "";
  if (openApiDocument.host) {
    return "https://" + openApiDocument.host + basePath;
  } else {
    return "http://localhost:{{PORT}}" + basePath;
  }
}
