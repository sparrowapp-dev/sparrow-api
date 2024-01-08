import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { WorkspaceDto } from "./workspace.model";
import { Type } from "class-transformer";
import { UserDto } from "./user.model";
import { ObjectId } from "mongodb";

export class Team {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @Type(() => WorkspaceDto)
  @ValidateNested({ each: true })
  @IsOptional()
  workspaces?: WorkspaceDto[];

  @IsArray()
  @Type(() => UserDto)
  @ValidateNested({ each: true })
  @IsOptional()
  users?: UserDto[];

  @IsArray()
  owners: string[];

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
}
