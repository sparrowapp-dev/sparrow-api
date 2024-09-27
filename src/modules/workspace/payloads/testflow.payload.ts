// ---- Libraries
import {
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNotEmpty,
  IsMongoId,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

// ---- Model
import {
  TestflowEdges,
  TestflowNodes,
} from "@src/modules/common/models/testflow.model";

/**
 * Data Transfer Object (DTO) for creating a new Testflow.
 * This class defines the structure of the request body that
 * will be used when creating a Testflow, including optional
 * and required properties such as name, workspaceId, edges, and nodes.
 *
 * @class CreateTestflowDto
 */
export class CreateTestflowDto {
  @IsString()
  @ApiProperty({ required: false, example: "New Testflow name" })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: true, example: "6544cdea4b3d3b043a96c307" })
  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;

  @ApiProperty({
    required: false,
    example: [
      {
        id: "id",
        source: "1",
        target: "2",
      },
    ],
  })
  @IsArray()
  @Type(() => TestflowEdges)
  @ValidateNested({ each: true })
  @IsOptional()
  edges?: TestflowEdges[];

  @ApiProperty({
    required: false,
    example: [
      {
        id: "id",
        type: "requestBlock",
        position: {
          x: 200,
          y: 300,
        },
        data: {
          requestId: "428347384723",
          collectionId: "4223522525",
          folderId: "23242532535",
        },
      },
    ],
  })
  @IsArray()
  @Type(() => TestflowNodes)
  @ValidateNested({ each: true })
  @IsOptional()
  nodes?: TestflowNodes[];
}

/**
 * Data Transfer Object (DTO) for updating an existing Testflow.
 * This class defines the structure of the request body that
 * will be used when updating a Testflow, including optional
 * properties such as name, edges, and nodes.
 *
 * @class UpdateTestflowDto
 */
export class UpdateTestflowDto {
  @IsString()
  @ApiProperty({ required: false, example: "New Testflow name" })
  @IsOptional()
  name?: string;

  @ApiProperty({
    required: false,
    example: [
      {
        id: "id",
        source: "1",
        target: "2",
      },
    ],
  })
  @IsArray()
  @Type(() => TestflowEdges)
  @ValidateNested({ each: true })
  @IsOptional()
  edges?: TestflowEdges[];

  @ApiProperty({
    required: false,
    example: [
      {
        id: "id",
        type: "requestBlock",
        position: {
          x: 200,
          y: 300,
        },
        data: {
          requestId: "428347384723",
          collectionId: "4223522525",
          folderId: "23242532535",
        },
      },
    ],
  })
  @IsArray()
  @Type(() => TestflowNodes)
  @ValidateNested({ each: true })
  @IsOptional()
  nodes?: TestflowNodes[];
}
