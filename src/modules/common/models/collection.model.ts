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
export enum ItemTypeEnum {
  FOLDER = "FOLDER",
  REQUEST = "REQUEST",
}
export enum BodyModeEnum {
  "application/json" = "application/json",
  "application/xml" = "application/xml",
  "application/x-www-form-urlencoded" = "application/x-www-form-urlencoded",
  "multipart/form-data" = "multipart/form-data",
  "application/javascript" = "application/javascript",
  "text/plain" = "text/plain",
  "text/html" = "text/html",
}

export enum SourceTypeEnum {
  SPEC = "SPEC",
  USER = "USER",
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

  @ApiProperty({ type: [RequestBody] })
  @Type(() => RequestBody)
  @ValidateNested({ each: true })
  @IsOptional()
  body?: RequestBody[];

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
  @IsNotEmpty()
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

  @ApiProperty({ enum: ["FOLDER", "REQUEST"] })
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

export class Collection {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

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

  @IsOptional()
  @IsDateString()
  createdAt?: Date;

  @IsOptional()
  @IsDateString()
  updatedAt?: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

export class CollectionDto {
  @IsMongoId()
  @IsNotEmpty()
  id: ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;
}
