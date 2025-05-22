import { ApiProperty } from "@nestjs/swagger";
import {
  AdminDto,
  WorkspaceType,
} from "@src/modules/common/models/workspace.model";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateWorkspaceDto {
  @ApiProperty({ example: "64f878a0293b1e4415866493" })
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    example: "workspace 1",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsArray()
  users?: string[];

  @IsDateString()
  @IsOptional()
  createdAt?: Date;

  @IsMongoId()
  @IsOptional()
  createdBy?: string;

  @IsBoolean()
  @IsOptional()
  firstWorkspace?: boolean;

  @ApiProperty({
    example: "This is the default workspace for the team.",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWorkspaceDto {
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

  @IsOptional()
  @IsArray()
  users?: string[];

  @IsDateString()
  @IsOptional()
  createdAt?: Date;

  @IsMongoId()
  @IsOptional()
  createdBy?: string;
}

export class UserDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsNotEmpty()
  @IsString()
  role: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class WorkspaceDtoForIdDocument {
  @IsMongoId()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsArray()
  @Type(() => AdminDto)
  @ValidateNested({ each: true })
  @IsOptional()
  admins?: AdminDto[];

  @IsArray()
  @Type(() => UserDto)
  @ValidateNested({ each: true })
  @IsOptional()
  users?: UserDto[];

  @IsDateString()
  @IsOptional()
  createdAt?: Date;

  @IsMongoId()
  @IsOptional()
  createdBy?: string;
}

export class workspaceUsersResponseDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;
}

export class UpdateWorkspaceTypeDto {
  @ApiProperty({ enum: WorkspaceType })
  @IsString()
  @IsNotEmpty()
  @IsEnum(WorkspaceType)
  workspaceType: WorkspaceType;
}
