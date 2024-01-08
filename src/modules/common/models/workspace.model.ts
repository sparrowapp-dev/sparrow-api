import { Type } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { CollectionDto } from "./collection.model";
import { ObjectId } from "mongodb";
import { PermissionDto } from "./user.model";
import { EnvironmentDto } from "./environment.model";

export enum WorkspaceType {
  PERSONAL = "PERSONAL",
  TEAM = "TEAM",
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

export class Workspace {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => OwnerInformationDto)
  @IsNotEmpty()
  owner: OwnerInformationDto;

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
  @IsOptional()
  permissions?: PermissionDto[];

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
