import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { CollectionDto } from "./collection.model";
import { ObjectId } from "mongodb";
import { EnvironmentDto } from "./environment.model";
import { TestflowInfoDto } from "./testflow.model";

export enum WorkspaceType {
  PRIVATE = "PRIVATE",
  PUBLIC = "PUBLIC",
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

export class AdminDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsNotEmpty()
  @IsString()
  name: string;
}

export class OwnerInformationDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsEnum(WorkspaceType)
  @IsNotEmpty()
  type: WorkspaceType;
}

export class TeamInfoDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  hubUrl?: string;
}

export class Workspace {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  @IsObject()
  team: TeamInfoDto;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsEnum(WorkspaceType)
  workspaceType?: WorkspaceType;

  @IsArray()
  @Type(() => CollectionDto)
  @ValidateNested({ each: true })
  @IsOptional()
  collection?: CollectionDto[];

  @IsArray()
  @Type(() => EnvironmentDto)
  @ValidateNested({ each: true })
  @IsOptional()
  environments?: EnvironmentDto[];

  @IsArray()
  @Type(() => TestflowInfoDto)
  @ValidateNested({ each: true })
  @IsOptional()
  testflows?: TestflowInfoDto[];

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

export class WorkspaceWithNewInviteTag extends Workspace {
  @IsBoolean()
  @IsOptional()
  isNewInvite?: boolean;
}

export class WorkspaceDto {
  @IsMongoId()
  @IsNotEmpty()
  id: ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;
}
