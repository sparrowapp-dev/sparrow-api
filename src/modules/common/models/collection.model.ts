import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { HTTPMethods } from "fastify";
import { ObjectId } from "mongodb";
import { SchemaObject } from "./openapi303.model";
import { ApiProperty } from "@nestjs/swagger";
import {
  Auth,
  KeyValue,
  SparrowRequestBody,
  TransformedRequest,
} from "./collection.rxdb.model";
export enum ItemTypeEnum {
  FOLDER = "FOLDER",
  REQUEST = "REQUEST",
  WEBSOCKET = "WEBSOCKET",
  SOCKETIO = "SOCKETIO",
  GRAPHQL = "GRAPHQL",
  REQUEST_RESPONSE = "REQUEST_RESPONSE",
  MOCK_REQUEST = "MOCK_REQUEST",
  MOCK_REQUEST_RESPONSE = "MOCK_REQUEST_RESPONSE",
  AI_REQUEST = "AI_REQUEST",
}

export enum BodyModeEnum {
  "none" = "none",
  "application/json" = "application/json",
  "application/xml" = "application/xml",
  "application/yaml" = "application/yaml",
  "application/x-www-form-urlencoded" = "application/x-www-form-urlencoded",
  "multipart/form-data" = "multipart/form-data",
  "application/javascript" = "application/javascript",
  "text/plain" = "text/plain",
  "text/html" = "text/html",
}

export enum ResponseBodyModeEnum {
  "none" = "none",
  "application/json" = "application/json",
  "application/xml" = "application/xml",
  "application/yaml" = "application/yaml",
  "application/javascript" = "application/javascript",
  "text/plain" = "text/plain",
  "text/html" = "text/html",
}

export enum PostmanBodyModeEnum {
  "none" = "none",
  "json" = "application/json",
  "xml" = "application/xml",
  "urlencoded" = "application/x-www-form-urlencoded",
  "formdata" = "multipart/form-data",
  "javascript" = "application/javascript",
  "text" = "text/plain",
  "html" = "text/html",
}

export enum CollectionAuthModeEnum {
  "No Auth" = "No Auth",
  "API Key" = "API Key",
  "Bearer Token" = "Bearer Token",
  "Basic Auth" = "Basic Auth",
}

export enum CollectionTypeEnum {
  MOCK = "MOCK",
  STANDARD = "STANDARD",
}

export enum AuthModeEnum {
  "No Auth" = "No Auth",
  "Inherit Auth" = "Inherit Auth",
  "API Key" = "API Key",
  "Bearer Token" = "Bearer Token",
  "Basic Auth" = "Basic Auth",
}

export enum PostmanAuthModeEnum {
  "noauth" = "No Auth",
  "inherit" = "Inherit Auth",
  "apikey" = "API Key",
  "bearer" = "Bearer Token",
  "basic" = "Basic Auth",
}

export enum SourceTypeEnum {
  SPEC = "SPEC",
  USER = "USER",
}

export enum WebSocketBodyModeEnum {
  "none" = "none",
  "application/json" = "application/json",
  "application/xml" = "application/xml",
  "text/plain" = "text/plain",
  "text/html" = "text/html",
}

export enum SocketIOBodyModeEnum {
  "none" = "none",
  "application/json" = "application/json",
  "application/xml" = "application/xml",
  "text/plain" = "text/plain",
  "text/html" = "text/html",
}
export class QueryParams {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars

export class RequestBody {
  @ApiProperty({
    enum: [
      "application/json",
      "application/xml",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
    ],
  })
  @IsEnum(BodyModeEnum)
  @IsNotEmpty()
  type: BodyModeEnum;

  @ApiProperty()
  @IsNotEmpty()
  schema?: SchemaObject;
}

export class Params {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsBoolean()
  required: boolean;

  @ApiProperty()
  @IsNotEmpty()
  schema: SchemaObject;
}

/**
 * Data Transfer Object representing an Event configuration.
 * This includes the event name and whether it is listening or not.
 */
export class Events {
  /**
   * Name of the event.
   *
   * @example "aiSupport"
   */
  @ApiProperty({ description: "Name of the event", example: "aiSupport" })
  @IsString()
  @IsNotEmpty()
  event: string;

  /**
   * Indicates if the event listener is active.
   *
   * @example true
   */
  @ApiProperty({
    description: "Flag indicating if the event should listen",
    example: true,
  })
  @IsBoolean()
  listen: boolean;
}

export class RequestMetaData {
  @ApiProperty({ example: "put" })
  @IsNotEmpty()
  method: HTTPMethods;

  @ApiProperty({ example: "updatePet" })
  @IsString()
  @IsOptional()
  operationId?: string;

  @ApiProperty({ example: "/pet" })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ type: [SparrowRequestBody] })
  @Type(() => SparrowRequestBody)
  @ValidateNested({ each: true })
  @IsOptional()
  body?: SparrowRequestBody;

  @ApiProperty({
    enum: [
      "application/json",
      "application/xml",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "application/javascript",
      "text/plain",
      "text/html",
    ],
  })
  @IsEnum({ BodyModeEnum })
  @IsString()
  @IsOptional()
  selectedRequestBodyType?: BodyModeEnum;

  @ApiProperty({
    enum: AuthModeEnum,
  })
  @IsEnum({ AuthModeEnum })
  @IsString()
  @IsNotEmpty()
  selectedRequestAuthType?: AuthModeEnum;

  @ApiProperty({
    example: {
      name: "search",
      description: "The search term to filter results",
      required: false,
      schema: {},
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  queryParams?: KeyValue[];

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "userID",
      description: "The unique identifier of the user",
      required: true,
      schema: {},
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  pathParams?: KeyValue[];

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "Authorization",
      description: "Bearer token for authentication",
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  headers?: KeyValue[];

  @ApiProperty({
    type: [Auth],
    example: {
      bearerToken: "Bearer xyz",
    },
  })
  @IsArray()
  @Type(() => Auth)
  @ValidateNested({ each: true })
  @IsOptional()
  auth?: Auth;
}

export class RequestResponseMetaData {
  @ApiProperty({ example: "put" })
  @IsNotEmpty()
  method: HTTPMethods;

  @ApiProperty({ example: "/pet" })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ type: [SparrowRequestBody] })
  @Type(() => SparrowRequestBody)
  @ValidateNested({ each: true })
  @IsOptional()
  body?: SparrowRequestBody;

  @ApiProperty({
    enum: [
      "application/json",
      "application/xml",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "application/javascript",
      "text/plain",
      "text/html",
    ],
  })
  @IsEnum({ BodyModeEnum })
  @IsString()
  @IsOptional()
  selectedRequestBodyType?: BodyModeEnum;

  @ApiProperty({
    enum: AuthModeEnum,
  })
  @IsEnum({ AuthModeEnum })
  @IsString()
  @IsNotEmpty()
  selectedRequestAuthType?: AuthModeEnum;

  @ApiProperty({
    example: {
      name: "search",
      description: "The search term to filter results",
      required: false,
      schema: {},
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  queryParams?: KeyValue[];

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "userID",
      description: "The unique identifier of the user",
      required: true,
      schema: {},
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  pathParams?: KeyValue[];

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "Authorization",
      description: "Bearer token for authentication",
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  headers?: KeyValue[];

  @ApiProperty({
    type: [Auth],
    example: {
      bearerToken: "Bearer xyz",
    },
  })
  @IsArray()
  @Type(() => Auth)
  @ValidateNested({ each: true })
  @IsOptional()
  auth?: Auth;

  @ApiProperty({ example: "body" })
  @IsString()
  @IsOptional()
  responseBody?: string;

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "Authorization",
      description: "Bearer token for authentication",
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  responseHeaders?: KeyValue[];

  @ApiProperty({ example: "200 OK" })
  @IsString()
  @IsOptional()
  responseStatus?: string;

  @ApiProperty({
    enum: [
      "application/json",
      "application/xml",
      "application/javascript",
      "text/plain",
      "text/html",
    ],
  })
  @IsEnum({ ResponseBodyModeEnum })
  @IsString()
  @IsOptional()
  selectedResponseBodyType?: ResponseBodyModeEnum;
}

export class MockRequestResponseMetaData {
  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  isMockResponseActive?: boolean;

  @ApiProperty({ example: "body" })
  @IsString()
  @IsOptional()
  responseBody?: string;

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "Authorization",
      description: "Bearer token for authentication",
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  responseHeaders?: KeyValue[];

  @ApiProperty({ example: "200 OK" })
  @IsString()
  @IsOptional()
  responseStatus?: string;

  @ApiProperty({
    enum: [
      "application/json",
      "application/xml",
      "application/javascript",
      "text/plain",
      "text/html",
    ],
  })
  @IsEnum({ ResponseBodyModeEnum })
  @IsString()
  @IsOptional()
  selectedResponseBodyType?: ResponseBodyModeEnum;
}

export class MockRequestMetaData {
  @ApiProperty({ example: "put" })
  @IsNotEmpty()
  method: HTTPMethods;

  @ApiProperty({ example: "/pet" })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ type: [SparrowRequestBody] })
  @Type(() => SparrowRequestBody)
  @ValidateNested({ each: true })
  @IsOptional()
  body?: SparrowRequestBody;

  @ApiProperty({
    enum: [
      "application/json",
      "application/xml",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "application/javascript",
      "text/plain",
      "text/html",
    ],
  })
  @IsEnum({ BodyModeEnum })
  @IsString()
  @IsOptional()
  selectedRequestBodyType?: BodyModeEnum;

  @ApiProperty({
    example: {
      name: "search",
      description: "The search term to filter results",
      required: false,
      schema: {},
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  queryParams?: KeyValue[];

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "userID",
      description: "The unique identifier of the user",
      required: true,
      schema: {},
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  pathParams?: KeyValue[];

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "Authorization",
      description: "Bearer token for authentication",
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  headers?: KeyValue[];

  @ApiProperty({ example: "body" })
  @IsString()
  @IsOptional()
  responseBody?: string;

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "Authorization",
      description: "Bearer token for authentication",
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  responseHeaders?: KeyValue[];

  @ApiProperty({ example: "200 OK" })
  @IsString()
  @IsOptional()
  responseStatus?: string;

  @ApiProperty({
    enum: [
      "application/json",
      "application/xml",
      "application/javascript",
      "text/plain",
      "text/html",
    ],
  })
  @IsEnum({ ResponseBodyModeEnum })
  @IsString()
  @IsOptional()
  selectedResponseBodyType?: ResponseBodyModeEnum;
}

export class AiRequestMetaData {
  @ApiProperty({ example: "openai" })
  @IsNotEmpty()
  aiModelProvider: "openai" | "anthropic" | "deepseek" | "gemini";

  @ApiProperty({ example: "gpt-4o" })
  @IsString()
  @IsNotEmpty()
  aiModelVariant: string; //ToDo: Add proper types (for type safety) for possible model versions

  @ApiProperty({ example: "Answer the user queries." })
  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @ApiProperty({
    type: [Auth],
    example: {
      bearerToken: "Bearer xyz",
    },
  })
  @IsArray()
  @Type(() => Auth)
  @ValidateNested({ each: true })
  @IsOptional()
  auth?: Auth;
}

/**
 * Data Transfer Object representing the metadata for a WebSocket connection.
 */
export class WebSocketMetaData {
  @ApiProperty({ example: "/pet" })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ example: "message" })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiProperty({
    enum: ["application/json", "application/xml", "text/plain", "text/html"],
  })
  @IsEnum({ WebSocketBodyModeEnum })
  @IsString()
  @IsOptional()
  selectedWebSocketBodyType?: WebSocketBodyModeEnum;

  @ApiProperty({
    example: {
      name: "search",
      description: "The search term to filter results",
      required: false,
      schema: {},
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  queryParams?: KeyValue[];

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "headers",
      description: "headers for websocket",
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  headers?: KeyValue[];
}

/**
 * Data Transfer Object representing the metadata for a Socket.IO connection.
 */
export class SocketIOMetaData {
  @ApiProperty({ example: "/pet" })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ example: "message" })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiProperty({ example: "eventName" })
  @IsString()
  @IsOptional()
  eventName?: string;

  @ApiProperty({
    enum: ["application/json", "application/xml", "text/plain", "text/html"],
  })
  @IsEnum({ SocketIOBodyModeEnum })
  @IsString()
  @IsOptional()
  selectedSocketIOBodyType?: SocketIOBodyModeEnum;

  @ApiProperty({
    example: {
      key: "key",
      value: "value",
      checked: true,
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  queryParams?: KeyValue[];

  @ApiProperty({
    type: [KeyValue],
    example: {
      key: "key",
      value: "value",
      checked: true,
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  headers?: KeyValue[];

  @ApiProperty({
    example: {
      event: "event name",
      listen: true,
    },
  })
  @IsArray()
  @Type(() => Events)
  @ValidateNested({ each: true })
  @IsOptional()
  events?: Events[];
}

/**
 * Data Transfer Object representing the metadata for a GraphQL connection.
 */
export class GraphQLMetaData {
  @ApiProperty({ example: "/pet" })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ example: "query" })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiProperty({ example: "schema of query" })
  @IsString()
  @IsOptional()
  schema?: string;

  @ApiProperty({
    type: [KeyValue],
    example: {
      key: "key",
      value: "value",
      checked: true,
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  headers?: KeyValue[];

  @ApiProperty({
    type: [Auth],
    example: {
      bearerToken: "Bearer xyz",
    },
  })
  @IsArray()
  @Type(() => Auth)
  @ValidateNested({ each: true })
  @IsOptional()
  auth?: Auth;
}

export class CollectionItem {
  @ApiProperty({ example: "64f878a0293b1e4415866493" })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: "pet" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "Everything about your Pets" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: ["FOLDER", "REQUEST", "WEBSOCKET", "SOCKETIO", "GRAPHQL"],
  })
  @IsEnum(ItemTypeEnum)
  @IsString()
  @IsNotEmpty()
  type: ItemTypeEnum;

  @ApiProperty({ enum: ["SPEC", "USER"] })
  @IsEnum(SourceTypeEnum)
  @IsOptional()
  @IsString()
  source?: SourceTypeEnum;

  @ApiProperty({
    type: [CollectionItem],
    example: {
      name: "/pet",
      description: "Update an existing pet by Id",
      type: "REQUEST",
      request: {},
    },
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionItem)
  @IsOptional()
  items?: CollectionItem[];

  @ApiProperty({ type: RequestMetaData })
  @IsOptional()
  @Type(() => RequestMetaData)
  request?: RequestMetaData;

  @ApiProperty({ type: RequestResponseMetaData })
  @IsOptional()
  @Type(() => RequestResponseMetaData)
  requestResponse?: RequestResponseMetaData;

  @ApiProperty({ type: MockRequestMetaData })
  @IsOptional()
  @Type(() => MockRequestMetaData)
  mockRequest?: MockRequestMetaData;

  @ApiProperty({ type: MockRequestResponseMetaData })
  @IsOptional()
  @Type(() => MockRequestResponseMetaData)
  mockRequestResponse?: MockRequestResponseMetaData;

  @ApiProperty({ type: WebSocketMetaData })
  @IsOptional()
  @Type(() => WebSocketMetaData)
  websocket?: WebSocketMetaData;

  @ApiProperty({ type: SocketIOMetaData })
  @IsOptional()
  @Type(() => SocketIOMetaData)
  socketio?: SocketIOMetaData;

  @ApiProperty({ type: GraphQLMetaData })
  @IsOptional()
  @Type(() => GraphQLMetaData)
  graphql?: GraphQLMetaData;

  @ApiProperty({ type: AiRequestMetaData })
  @IsOptional()
  @Type(() => AiRequestMetaData)
  aiRequest?: AiRequestMetaData;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;

  @IsString()
  createdBy: string;

  @IsString()
  updatedBy: string;
}

export class CollectionBranch {
  @ApiProperty({ example: "64f878a0293b1e4415866493" })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdaterDetails {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  id?: string;
}

export class MockRequestHistory {
  @ApiProperty()
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ description: "Timestamp when the request was made" })
  @IsDate()
  timestamp: Date;

  @ApiProperty({ description: "Name of the mock request" })
  @IsString()
  name: string;

  @ApiProperty({ description: "Endpoint of the mock request" })
  @IsString()
  url: string;

  @ApiProperty({ example: "put" })
  @IsNotEmpty()
  method: HTTPMethods;

  @ApiProperty({ example: "200 OK" })
  @IsString()
  @IsOptional()
  responseStatus?: string;

  @ApiProperty({
    description: "Duration of request processing in milliseconds",
  })
  @IsNumber()
  duration: number;

  @ApiProperty({
    type: [KeyValue],
    example: {
      key: "key",
      value: "value",
      checked: true,
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  requestHeaders?: KeyValue[];

  @ApiProperty({ type: [SparrowRequestBody] })
  @Type(() => SparrowRequestBody)
  @ValidateNested({ each: true })
  @IsOptional()
  requestBody?: SparrowRequestBody;

  @ApiProperty({
    enum: [
      "application/json",
      "application/xml",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "application/javascript",
      "text/plain",
      "text/html",
    ],
  })
  @IsEnum({ BodyModeEnum })
  @IsString()
  @IsOptional()
  selectedRequestBodyType?: BodyModeEnum;

  @ApiProperty({
    enum: [
      "application/json",
      "application/xml",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "application/javascript",
      "text/plain",
      "text/html",
    ],
  })
  @IsEnum({ BodyModeEnum })
  @IsString()
  @IsOptional()
  selectedResponseBodyType?: BodyModeEnum;

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "Authorization",
      description: "Bearer token for authentication",
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  responseHeaders?: KeyValue[];

  @ApiProperty({ example: "body" })
  @IsString()
  @IsOptional()
  responseBody?: string;
}

export class Collection {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiProperty({
    enum: CollectionTypeEnum,
  })
  @IsEnum({ CollectionTypeEnum })
  @IsString()
  @IsOptional()
  collectionType?: CollectionTypeEnum;

  @ApiProperty()
  @IsString()
  @IsOptional()
  mockCollectionUrl?: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isMockCollectionRunning?: boolean;

  @ApiProperty({
    enum: CollectionAuthModeEnum,
  })
  @IsEnum({ CollectionAuthModeEnum })
  @IsString()
  @IsOptional()
  selectedAuthType?: CollectionAuthModeEnum;

  @ApiProperty({
    type: [Auth],
    example: {
      bearerToken: "Bearer xyz",
    },
  })
  @IsArray()
  @Type(() => Auth)
  @ValidateNested({ each: true })
  @IsOptional()
  auth?: Auth;

  @ApiProperty()
  @IsString()
  @IsOptional()
  primaryBranch?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  localRepositoryPath?: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  totalRequests: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  uuid?: string;

  @ApiProperty({ type: [MockRequestHistory] })
  @IsArray()
  @IsOptional()
  mockRequestHistory?: MockRequestHistory[];

  @ApiProperty({ type: [CollectionItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionItem)
  items: CollectionItem[];

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  activeSync?: boolean;

  @ApiProperty()
  @IsString()
  @IsOptional()
  activeSyncUrl?: string;

  @ApiProperty({ type: [CollectionBranch] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CollectionBranch)
  branches?: CollectionBranch[] | TransformedRequest[];

  @IsOptional()
  @IsDateString()
  createdAt?: Date;

  @IsOptional()
  @IsDateString()
  updatedAt?: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsOptional()
  @Type(() => UpdaterDetails)
  updatedBy?: UpdaterDetails;

  @IsOptional()
  @IsDateString()
  syncedAt?: Date;
}

export class CollectionDto {
  @IsMongoId()
  @IsNotEmpty()
  id: ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  activeSync?: boolean;
}
