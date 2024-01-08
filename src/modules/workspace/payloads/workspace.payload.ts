import { ApiProperty } from "@nestjs/swagger";
import { WorkspaceType } from "@src/modules/common/models/workspace.model";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { PermissionDto } from "./permission.payload";

export class WorkspaceDto {
  @ApiProperty({ example: "64f878a0293b1e4415866493" })
  @IsMongoId()
  @IsOptional()
  id?: string;

  @IsArray()
  @IsOptional()
  owners?: string[];

  @IsOptional()
  @IsArray()
  users?: string[];

  @IsOptional()
  @IsArray()
  permissions?: PermissionDto[];

  @IsDateString()
  @IsOptional()
  createdAt?: Date;

  @IsMongoId()
  @IsOptional()
  createdBy?: string;
}

export class CreateWorkspaceDto extends WorkspaceDto {
  @ApiProperty({
    example: "workspace 1",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: WorkspaceType.TEAM,
  })
  @IsEnum(WorkspaceType)
  @IsNotEmpty()
  type: WorkspaceType;
}

export class UpdateWorkspaceDto extends WorkspaceDto {
  @ApiProperty({
    example: "workspace 1",
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: "Description of Workspace",
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class WorkspaceDtoForIdDocument {
  @IsMongoId()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsEnum(WorkspaceType)
  @IsNotEmpty()
  type?: WorkspaceType;

  @IsArray()
  @IsOptional()
  owners?: string[];

  @IsOptional()
  @IsArray()
  users?: string[];

  @IsOptional()
  @IsArray()
  permissions?: PermissionDto[];

  @IsDateString()
  @IsOptional()
  createdAt?: Date;

  @IsMongoId()
  @IsOptional()
  createdBy?: string;
}
