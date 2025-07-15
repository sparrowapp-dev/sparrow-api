import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Auth, KeyValue, SparrowRequestBody } from "./collection.rxdb.model";
import { AuthModeEnum, BodyModeEnum } from "./collection.model";
import { HTTPMethods } from "fastify";

export class RequestMetaData {
  @ApiProperty({ example: "put" })
  @IsNotEmpty()
  method: HTTPMethods;

  @ApiProperty({ example: "pet" })
  @IsString()
  @IsNotEmpty()
  name: string;

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

/**
 * Represents the edges of a Testflow which tell the connection between nodes.
 */
export class TestflowEdges {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsString()
  @IsNotEmpty()
  target: string;
}

/**
 * Represents the position of a node in a Testflow graph.
 */
export class NodePosition {
  @IsNumber()
  @IsNotEmpty()
  x: number;

  @IsNumber()
  @IsNotEmpty()
  y: number;
}

/**
 * Represents the data associated with a node in a Testflow like requestId.
 */
export class NodeData {
  @IsString()
  @IsNotEmpty()
  blockName: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  requestId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  folderId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  collectionId?: string;

  @ApiProperty({ type: RequestMetaData })
  @IsOptional()
  @Type(() => RequestMetaData)
  requestData?: RequestMetaData;
}

/**
 * Represents the nodes of the API blocks in a Testflow .
 */
export class TestflowNodes {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @Type(() => NodePosition)
  @IsOptional()
  position?: NodePosition;

  @Type(() => NodeData)
  @IsOptional()
  data?: NodeData;
}

/**
 * Represents a Testflow, containing nodes and edges.
 */
export class Testflow {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;

  @IsArray()
  @Type(() => TestflowEdges)
  @ValidateNested({ each: true })
  @IsOptional()
  edges: TestflowEdges[];

  @IsArray()
  @Type(() => TestflowNodes)
  @ValidateNested({ each: true })
  @IsOptional()
  nodes: TestflowNodes[];

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

/**
 * Represents a DTO containing brief information about a Testflow.
 */
export class TestflowInfoDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;
}
