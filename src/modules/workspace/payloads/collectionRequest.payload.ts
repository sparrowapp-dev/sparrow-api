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
  ItemTypeEnum,
} from "@src/modules/common/models/collection.model";

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

  @ApiProperty({ type: CollectionRequestMetaData })
  @IsOptional()
  @Type(() => CollectionRequestMetaData)
  request?: CollectionRequestMetaData;
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
  folderId: string;

  @ApiProperty()
  @Type(() => CollectionRequestItem)
  @ValidateNested({ each: true })
  items?: CollectionRequestItem;
}

export class FolderPayload {
  @ApiProperty({ example: "pet" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "Everything about your Pets" })
  @IsString()
  @IsOptional()
  description: string;
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

  @IsString()
  @IsNotEmpty()
  collectionId: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string;
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
}
