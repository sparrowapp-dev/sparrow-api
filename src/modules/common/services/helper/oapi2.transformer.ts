import { v4 as uuidv4 } from "uuid";

// ---- Models
import {
  AuthModeEnum,
  BodyModeEnum,
  ItemTypeEnum,
  SourceTypeEnum,
} from "../../models/collection.model";
import {
  OpenAPI20,
  OperationObject,
  ParameterObject,
  PathItemObject,
} from "../../models/openapi20.model";
import { AddTo, TransformedRequest } from "../../models/collection.rxdb.model";

// ---- Tranformers
import {
  buildExampleValue,
  getBaseUrl,
  getExampleValue,
} from "./oapi3.transformer";

/**
 * Creates collection items from an OpenAPI 2.0 document.
 * @param openApiDocument - OOpenAPI 2.0 document.
 * @param user - User object with ID.
 * @returns Map containing transformed request items.
 */
export function createCollectionItems(
  openApiDocument: OpenAPI20,
  username: string,
) {
  const collectionItems: TransformedRequest[] = [];
  // Check if definitions are present in the OpenAPI document
  if (openApiDocument.definitions) {
    //Get all collection items
    for (const [pathName, pathObject] of Object.entries(
      openApiDocument.paths,
    )) {
      const requests = transformPath(
        pathName,
        pathObject,
        openApiDocument.securityDefinitions,
        username,
      );
      // Create a collection item for each request object
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
          createdBy: username,
          updatedBy: username,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  const baseUrl = getBaseUrl(openApiDocument);

  //Assigning requests to folders according to their tag
  const folderMap = new Map();
  for (const item of collectionItems) {
    item.request.url = baseUrl + item.request.url;
    let tagDescription = "";
    // Ensure there is at least one tag
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

    // Create or retrieve the folder object and add the item to it
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

/**
 * Transforms a path object into an array of transformed request objects.
 * @param pathName - Path name.
 * @param pathObject - Path item object.
 * @param security - Security definitions.
 * @param user - User object with ID.
 * @returns Array of transformed request objects.
 */
function transformPath(
  pathName: string,
  pathObject: PathItemObject,
  security: any,
  username: string,
) {
  const transformedObjectArray: TransformedRequest[] = [];
  for (const [methodType, pathItemObjectType] of Object.entries(pathObject)) {
    const keyValueDefaultObj = {
      key: "",
      value: "",
      checked: false,
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
      createdBy: username,
      updatedBy: username,
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
      pathItemObject.summary || pathItemObject.description || ""; // Use summary or description if available
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

    let consumes: any = null;
    if (pathItemObject.consumes) {
      consumes = Object.values(pathItemObject.consumes) || [];
      if (consumes.includes("application/json")) {
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["application/json"];
      } else if (consumes.includes("application/javascript")) {
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["application/javascript"];
      } else if (consumes.includes("text/html")) {
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["text/html"];
      } else if (
        consumes.includes("application/xml") ||
        consumes.includes("text/xml")
      ) {
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["application/xml"];
      } else if (consumes.includes("application/x-www-form-urlencoded")) {
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["application/x-www-form-urlencoded"];
      } else if (consumes.includes("multipart/form-data")) {
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["multipart/form-data"];
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
              for (const [propertyName, property] of Object.entries(
                properties,
              )) {
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
            value: paramValue.toString(),
            checked: true,
          });
          break;
        case "query":
          transformedObject.request.queryParams.push({
            key: paramName,
            value: paramValue.toString(),
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
              transformedObject.request.body.formdata.file.push({
                key: paramName,
                value: paramValue,
                checked: false,
                base: "" + paramValue,
              });
            } else {
              transformedObject.request.body.formdata.text.push({
                key: paramName,
                value: paramValue,
                checked: false,
              });
            }
          }
      }
    }

    //Assign default values
    transformedObject.request.headers.push(keyValueDefaultObj);
    transformedObject.request.queryParams.push(keyValueDefaultObj);
    transformedObject.request.body.formdata.text.push(keyValueDefaultObj);
    transformedObject.request.body.urlencoded.push(keyValueDefaultObj);
    transformedObjectArray.push(transformedObject);
  }

  return transformedObjectArray;
}
