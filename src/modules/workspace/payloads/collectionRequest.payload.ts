import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { HTTPMethods } from "fastify";
import { SchemaObject } from "@src/modules/common/models/openapi303.model";
import { ApiProperty } from "@nestjs/swagger";
import {
  BodyModeEnum,
  Events,
  ItemTypeEnum,
  MockRequestMetaData,
  RequestMetaData,
  RequestResponseMetaData,
  ResponseBodyModeEnum,
  SourceTypeEnum,
} from "@src/modules/common/models/collection.model";
import {
  Auth,
  KeyValue,
} from "@src/modules/common/models/collection.rxdb.model";

// eslint-disable-next-line @typescript-eslint/no-unused-vars

export class CollectionRequestBody {
  @ApiProperty({ example: "application/json" })
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

export class CollectionRequestMetaData {
  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: "post" })
  @IsNotEmpty()
  method: HTTPMethods;

  @ApiProperty({ example: "uploadFile" })
  @IsString()
  @IsNotEmpty()
  operationId: string;

  @ApiProperty({ example: "/pet/{petId}/uploadImage" })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ type: [CollectionRequestBody] })
  @Type(() => CollectionRequestBody)
  @ValidateNested({ each: true })
  @IsOptional()
  body?: CollectionRequestBody[];

  @ApiProperty({
    type: [Params],
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
      name: "userID",
      description: "The unique identifier of the user",
      required: true,
      schema: {},
    },
  })
  @IsArray()
  @Type(() => Params)
  @ValidateNested({ each: true })
  @IsOptional()
  pathParams?: Params[];

  @ApiProperty({
    type: [Params],
    example: {
      name: "Authorization",
      description: "Bearer token for authentication",
    },
  })
  @IsArray()
  @Type(() => Params)
  @ValidateNested({ each: true })
  @IsOptional()
  headers?: Params[];

  @ApiProperty({
    type: [Auth],
    example: {
      apiKey: {
        authKey: "",
        authValue: "",
        paramType: "header",
      },
      bearerToken: "",
      basicToken: {
        username: "",
        password: "",
      },
    },
  })
  @Type(() => Auth)
  @IsOptional()
  auth?: Auth;
}

/**
 * Data Transfer Object representing the metadata for a WebSocket within a collection.
 */
export class CollectionWebSocketMetaData {
  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: "/pet/{petId}/uploadImage" })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ example: "message" })
  @IsString()
  @IsOptional()
  message?: string;

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
}

/**
 * Data Transfer Object representing the metadata for a Socket.IO within a collection.
 */
export class CollectionSocketIOMetaData {
  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: "/pet/{petId}/uploadImage" })
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
 * Data Transfer Object representing the metadata for a GraphQL within a collection.
 */
export class CollectionGraphQLMetaData {
  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsOptional()
  @IsString()
  id?: string;

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

export class CollectionRequestItem {
  @ApiProperty({ example: "e25a5332-7b80-48f3-8e4f-6e229bcedd43" })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: "/pet/{petId}/uploadImage" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "Description About Pets" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ["FOLDER", "REQUEST"] })
  @IsEnum(ItemTypeEnum)
  @IsNotEmpty()
  type: ItemTypeEnum;

  @ApiProperty({
    type: [CollectionRequestItem],
    example: {
      name: "/pet",
      description: "Update an existing pet by Id",
      type: "REQUEST",
      request: {},
    },
  })
  @ValidateNested({ each: true })
  @Type(() => CollectionRequestItem)
  @IsOptional()
  items?: CollectionRequestItem;

  @ApiProperty({ type: RequestMetaData })
  @IsOptional()
  @Type(() => RequestMetaData)
  request?: RequestMetaData;

  @ApiProperty({ type: RequestResponseMetaData })
  @IsOptional()
  @Type(() => RequestResponseMetaData)
  requestResponse?: RequestResponseMetaData;

  @ApiProperty({ type: CollectionWebSocketMetaData })
  @IsOptional()
  @Type(() => CollectionWebSocketMetaData)
  websocket?: CollectionWebSocketMetaData;

  @ApiProperty({ type: CollectionSocketIOMetaData })
  @IsOptional()
  @Type(() => CollectionSocketIOMetaData)
  socketio?: CollectionSocketIOMetaData;

  @ApiProperty({ type: CollectionGraphQLMetaData })
  @IsOptional()
  @Type(() => CollectionGraphQLMetaData)
  graphql?: CollectionGraphQLMetaData;

  @ApiProperty({ type: MockRequestMetaData })
  @IsOptional()
  @Type(() => MockRequestMetaData)
  mockRequest?: MockRequestMetaData;
}

export class CollectionRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  totalRequests: number;

  @ApiProperty({ type: [CollectionRequestItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionRequestItem)
  items: CollectionRequestItem[];

  @IsOptional()
  @IsDateString()
  createdAt?: Date;

  @IsOptional()
  @IsDateString()
  updatedAt?: Date;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  createdBy?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  updatedBy?: string;
}

export class QueryParams {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class CollectionRequestDto {
  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  collectionId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsOptional()
  folderId?: string;

  @ApiProperty({ enum: ["SPEC", "USER"] })
  @IsEnum(SourceTypeEnum)
  @IsOptional()
  @IsString()
  source?: SourceTypeEnum;

  @ApiProperty()
  @Type(() => CollectionRequestItem)
  @ValidateNested({ each: true })
  items?: CollectionRequestItem;

  @ApiProperty({ example: "main" })
  @IsString()
  @IsOptional()
  currentBranch?: string;
}

/**
 * Data Transfer Object representing a WebSocket in a collection.
 */
export class CollectionWebSocketDto {
  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  collectionId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsOptional()
  folderId?: string;

  @ApiProperty({ enum: ["SPEC", "USER"] })
  @IsEnum(SourceTypeEnum)
  @IsOptional()
  @IsString()
  source?: SourceTypeEnum;

  @ApiProperty()
  @Type(() => CollectionRequestItem)
  @ValidateNested({ each: true })
  items?: CollectionRequestItem;

  @ApiProperty({ example: "main" })
  @IsString()
  @IsOptional()
  currentBranch?: string;
}

/**
 * Data Transfer Object representing a Socket.IO in a collection.
 */
export class CollectionSocketIODto {
  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  collectionId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsOptional()
  folderId?: string;

  @ApiProperty({ enum: ["SPEC", "USER"] })
  @IsEnum(SourceTypeEnum)
  @IsOptional()
  @IsString()
  source?: SourceTypeEnum;

  @ApiProperty()
  @Type(() => CollectionRequestItem)
  @ValidateNested({ each: true })
  items?: CollectionRequestItem;

  @ApiProperty({ example: "main" })
  @IsString()
  @IsOptional()
  currentBranch?: string;
}

/**
 * Data Transfer Object representing a GraphQL in a collection.
 */
export class CollectionGraphQLDto {
  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  collectionId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsOptional()
  folderId?: string;

  @ApiProperty({ enum: ["SPEC", "USER"] })
  @IsEnum(SourceTypeEnum)
  @IsOptional()
  @IsString()
  source?: SourceTypeEnum;

  @ApiProperty()
  @Type(() => CollectionRequestItem)
  @ValidateNested({ each: true })
  items?: CollectionRequestItem;

  @ApiProperty({ example: "main" })
  @IsString()
  @IsOptional()
  currentBranch?: string;
}

/**
 * Data Transfer Object representing a Request Response in a collection.
 */
export class CollectionRequestResponseDto {
  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  collectionId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsOptional()
  folderId?: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  requestId: string;

  @ApiProperty({ enum: ["SPEC", "USER"] })
  @IsEnum(SourceTypeEnum)
  @IsOptional()
  @IsString()
  source?: SourceTypeEnum;

  @ApiProperty()
  @Type(() => CollectionRequestItem)
  @ValidateNested({ each: true })
  items?: CollectionRequestItem;

  @ApiProperty({ example: "main" })
  @IsString()
  @IsOptional()
  currentBranch?: string;
}

/**
 * Data Transfer Object representing a update Response in a collection.
 */
export class UpdateCollectionRequestResponseDto {
  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  collectionId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsOptional()
  folderId?: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsNotEmpty()
  requestId: string;

  @ApiProperty({ example: "6538e910aa77d958912371f5" })
  @IsString()
  @IsOptional()
  responseId?: string;

  @ApiProperty({ example: "response name" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: "response description" })
  @IsString()
  @IsOptional()
  description?: string;

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

export class FolderPayload {
  @ApiProperty({ example: "pet" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: "Everything about your Pets" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: SourceTypeEnum.USER })
  @IsEnum(SourceTypeEnum)
  @IsOptional()
  source?: SourceTypeEnum;

  @ApiProperty({ example: "development" })
  @IsString()
  @IsOptional()
  currentBranch?: string;
}

export class FolderDto {
  @IsString()
  @IsOptional()
  folderId?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(SourceTypeEnum)
  @IsOptional()
  source?: SourceTypeEnum;

  @IsString()
  @IsNotEmpty()
  collectionId: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsString()
  @IsOptional()
  currentBranch?: string;
}

export class DeleteFolderDto {
  @IsString()
  @IsNotEmpty()
  collectionId: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsString()
  @IsNotEmpty()
  folderId: string;

  @IsString()
  @IsOptional()
  currentBranch?: string;
}

export class BranchChangeDto {
  @ApiProperty({ example: "development" })
  @IsString()
  @IsNotEmpty()
  branchName: string;
}
