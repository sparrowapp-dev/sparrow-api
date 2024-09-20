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

export enum AuthModeEnum {
  "No Auth" = "No Auth",
  "API Key" = "API Key",
  "Bearer Token" = "Bearer Token",
  "Basic Auth" = "Basic Auth",
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

export class RequestMetaData {
  @ApiProperty({ example: "put" })
  @IsNotEmpty()
  method: HTTPMethods;

  @ApiProperty({ example: "updatePet" })
  @IsString()
  @IsNotEmpty()
  operationId: string;

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
  @Type(() => Params)
  @ValidateNested({ each: true })
  @IsOptional()
  queryParams?: Params[];

  @ApiProperty({
    type: [Params],
    example: {
      name: "headers",
      description: "headers for websocket",
    },
  })
  @IsArray()
  @Type(() => Params)
  @ValidateNested({ each: true })
  @IsOptional()
  headers?: Params[];
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

  @ApiProperty({ enum: ["FOLDER", "REQUEST", "WEBSOCKET"] })
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

  @ApiProperty({ type: WebSocketMetaData })
  @IsOptional()
  @Type(() => WebSocketMetaData)
  websocket?: WebSocketMetaData;

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

export class Collection {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description?: string;

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
