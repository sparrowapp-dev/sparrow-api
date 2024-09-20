import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

/**
 * Represents the edges of a Testflow which tell the connection between nodes.
 */
export class TestflowEdges {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsBoolean()
  @IsNotEmpty()
  selected: boolean;

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
