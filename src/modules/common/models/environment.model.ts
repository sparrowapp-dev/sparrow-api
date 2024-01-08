import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ObjectId } from "mongodb";

export enum DefaultEnvironment {
  GLOBAL = "Global Variables",
}

export enum EnvironmentType {
  GLOBAL = "GLOBAL",
  LOCAL = "LOCAL",
}

export class VariableDto {
  @IsString()
  key: string;

  @IsString()
  value: string;

  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  checked?: boolean;
}

export class Environment {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @Type(() => VariableDto)
  @ValidateNested({ each: true })
  @IsOptional()
  variable: VariableDto[];

  @IsEnum(EnvironmentType)
  @IsNotEmpty()
  type: EnvironmentType;

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

export class EnvironmentDto {
  @IsMongoId()
  @IsNotEmpty()
  id: ObjectId;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsEnum(EnvironmentType)
  @IsNotEmpty()
  @IsOptional()
  type?: EnvironmentType;
}
