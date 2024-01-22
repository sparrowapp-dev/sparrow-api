import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { WorkspaceDto } from "./workspace.model";
import { Type } from "class-transformer";
import { UserDto } from "./user.model";
import { ObjectId } from "mongodb";

export class logoDto {
  @IsString()
  @IsOptional()
  bufferString?: string;

  @IsString()
  @IsOptional()
  encoding?: string;

  @IsString()
  @IsOptional()
  mimetype?: string;

  @IsNumber()
  @IsOptional()
  size?: number;
}

export class Team {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsObject()
  logo?: logoDto;

  @IsArray()
  @Type(() => WorkspaceDto)
  @ValidateNested({ each: true })
  @IsOptional()
  workspaces?: WorkspaceDto[];

  @IsArray()
  @Type(() => UserDto)
  @ValidateNested({ each: true })
  users: UserDto[];

  @IsArray()
  @IsNotEmpty()
  owner: string;

  @IsArray()
  @IsOptional()
  admins?: string[];

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

export class TeamDto {
  @IsMongoId()
  @IsNotEmpty()
  id: ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  role: string;
}
