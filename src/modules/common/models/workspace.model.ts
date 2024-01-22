import { Type } from "class-transformer";
import {
  IsArray,
  IsDate,
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

export enum WorkspaceType {
  PERSONAL = "PERSONAL",
  TEAM = "TEAM",
}

export class UserDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsNotEmpty()
  @IsString()
  role: string;
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

export class WorkspaceDto {
  @IsMongoId()
  @IsNotEmpty()
  id: ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;
}
