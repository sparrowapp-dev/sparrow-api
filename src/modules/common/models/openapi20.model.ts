export interface OpenAPI20 {
  swagger: string;
  info: InfoObject;
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  produces?: string[];
  paths: PathsObject;
  definitions?: DefinitionsObject;
  parameters?: ParametersDefinitionsObject;
  responses?: ResponsesDefinitionsObject;
  securityDefinitions?: SecurityDefinitionsObject;
  security?: SecurityRequirementObject[];
  tags?: TagObject[];
  externalDocs?: ExternalDocumentationObject;
}

interface InfoObject {
  title: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
  version: string;
}

interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

interface LicenseObject {
  name: string;
  url?: string;
}

interface PathsObject {
  [path: string]: PathItemObject;
}

interface PathItemObject {
  $ref?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  parameters?: (ParameterObject | ReferenceObject)[];
}

interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
  operationId?: string;
  consumes?: string[];
  produces?: string[];
  parameters?: (ParameterObject | ReferenceObject)[];
  responses: ResponsesObject;
  schemes?: string[];
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
}

interface ParameterObject {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
}

interface ReferenceObject {
  $ref: string;
}

interface ResponsesObject {
  [code: string]: ResponseObject | ReferenceObject;
}

interface ResponseObject {
  description: string;
  schema?: SchemaObject;
}

interface SchemaObject {
  type: string;
  format?: string;
  items?: SchemaObject;
  properties?: {
    [name: string]: SchemaObject;
  };
  required?: string[];
  enum?: any[];
}

interface DefinitionsObject {
  [name: string]: SchemaObject;
}

interface ParametersDefinitionsObject {
  [name: string]: ParameterObject;
}

interface ResponsesDefinitionsObject {
  [name: string]: ResponseObject;
}

interface SecurityDefinitionsObject {
  [name: string]: SecuritySchemeObject;
}

interface SecuritySchemeObject {
  type: string;
  description?: string;
  name: string;
  in: string;
  flow: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: {
    [scope: string]: string;
  };
}

interface SecurityRequirementObject {
  [name: string]: string[];
}

interface TagObject {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
}

interface ExternalDocumentationObject {
  description?: string;
  url: string;
}
