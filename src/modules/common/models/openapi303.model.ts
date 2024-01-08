export interface OpenAPI303 {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name?: string;
      url?: string;
    };
  };
  host?: string;
  basePath?: string;
  servers?: ServerObject[];
  paths: {
    [path: string]: PathItemObject;
  };
  components?: {
    schemas?: {
      [schemaName: string]: SchemaObject;
    };
    responses?: {
      [responseName: string]: ResponseObject;
    };
    parameters?: {
      [parameterName: string]: ParameterObject;
    };
    examples?: {
      [exampleName: string]: ExampleObject;
    };
    requestBodies?: {
      [requestBodyName: string]: RequestBodyObject;
    };
    headers?: {
      [headerName: string]: HeaderObject;
    };
    securitySchemes?: {
      [schemeName: string]: SecuritySchemeObject;
    };
    links?: {
      [linkName: string]: LinkObject;
    };
    callbacks?: {
      [callbackName: string]: CallbackObject;
    };
  };
  security?: SecurityRequirementObject[];
  tags?: TagObject[];
  externalDocs?: ExternalDocumentationObject;
}

interface ServerObject {
  url: string;
  description?: string;
  variables?: {
    [variableName: string]: ServerVariableObject;
  };
}

interface ServerVariableObject {
  enum?: string[];
  default: string;
  description?: string;
}

interface PathItemObject {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  servers?: ServerObject[];
  parameters?: (ParameterObject | ReferenceObject)[];
}

interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
  operationId?: string;
  parameters?: (ParameterObject | ReferenceObject)[];
  requestBody?: RequestBodyObject | ReferenceObject;
  responses: {
    [statusCode: string]: ResponseObject | ReferenceObject;
  };
  callbacks?: {
    [callbackName: string]: CallbackObject | ReferenceObject;
  };
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
  servers?: ServerObject[];
}

interface ExternalDocumentationObject {
  description?: string;
  url: string;
}

export interface ParameterObject {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: SchemaObject | ReferenceObject;
  example?: any;
  examples?: {
    [exampleName: string]: ExampleObject | ReferenceObject;
  };
  content?: {
    [mediaType: string]: MediaTypeObject;
  };
}

interface RequestBodyObject {
  description?: string;
  content: {
    [mediaType: string]: MediaTypeObject;
  };
  required?: boolean;
}

interface ResponseObject {
  description: string;
  headers?: {
    [headerName: string]: HeaderObject | ReferenceObject;
  };
  content?: {
    [mediaType: string]: MediaTypeObject;
  };
  links?: {
    [linkName: string]: LinkObject | ReferenceObject;
  };
}

interface MediaTypeObject {
  schema?: SchemaObject | ReferenceObject;
  example?: any;
  examples?: {
    [exampleName: string]: ExampleObject | ReferenceObject;
  };
  encoding?: {
    [propertyName: string]: EncodingObject;
  };
}

interface EncodingObject {
  contentType?: string;
  headers?: {
    [headerName: string]: HeaderObject | ReferenceObject;
  };
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface SchemaObject {
  type?: string;
  nullable?: boolean;
  title?: string;
  description?: string;
  format?: string;
  default?: any;
  enum?: any[];
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  additionalProperties?: boolean | SchemaObject | ReferenceObject;
  items?: SchemaObject | ReferenceObject;
  allOf?: (SchemaObject | ReferenceObject)[];
  oneOf?: (SchemaObject | ReferenceObject)[];
  anyOf?: (SchemaObject | ReferenceObject)[];
  not?: SchemaObject | ReferenceObject;
  properties?: {
    [propertyName: string]: SchemaObject | ReferenceObject;
  };
  dependencies?: {
    [propertyName: string]: SchemaObject | string[];
  };
  propertyNames?: SchemaObject | ReferenceObject;
  const?: any;
  contentMediaType?: string;
  contentEncoding?: string;
  if?: SchemaObject | ReferenceObject;
  then?: SchemaObject | ReferenceObject;
  else?: SchemaObject | ReferenceObject;
}

interface ExampleObject {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: {
    [parameterName: string]: any;
  };
  requestBody?: any;
  description?: string;
  server?: ServerObject;
}

interface CallbackObject {
  [expression: string]: PathItemObject;
}

export interface ReferenceObject {
  $ref: string;
}

interface HeaderObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: SchemaObject | ReferenceObject;
  example?: any;
  examples?: {
    [exampleName: string]: ExampleObject | ReferenceObject;
  };
  content?: {
    [mediaType: string]: MediaTypeObject;
  };
}

interface SecuritySchemeObject {
  type: string;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlowsObject;
  openIdConnectUrl?: string;
}

interface OAuthFlowsObject {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}

interface OAuthFlowObject {
  authorizationUrl: string;
  tokenUrl: string;
  refreshUrl?: string;
  scopes: {
    [scopeName: string]: string;
  };
}

interface TagObject {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
}

interface SecurityRequirementObject {
  [securityRequirementName: string]: string[];
}
