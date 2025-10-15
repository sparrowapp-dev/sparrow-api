import { IsNotEmpty, IsMongoId } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsDate,
} from "class-validator";
import { Type } from "class-transformer";
import { ObjectId } from "mongodb";

export class DowngradeUserDto {
  @ApiProperty({ example: "64f03af32e420f7f68055b92" })
  @IsMongoId()
  @IsNotEmpty()
  teamId: string;

  @ApiProperty({ example: "64f03af32e420f7f68055b92" })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;
}

export class TourGuideDto {
  @IsBoolean()
  @IsOptional()
  isRequestTestsNoCodeDemoCompleted?: boolean;

  @IsBoolean()
  @IsOptional()
  isGenerateVariableDemoCompleted?: boolean;

  @IsBoolean()
  @IsOptional()
  isRequestTestsScriptDemoCompleted?: boolean;
}

class UserWorkspaceDto {
  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsMongoId()
  @IsNotEmpty()
  teamId: string;

  @IsBoolean()
  @IsOptional()
  isNewInvite?: boolean;
}

class TeamDto {
  @IsMongoId()
  @IsNotEmpty()
  id: ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsBoolean()
  @IsOptional()
  isNewInvite?: boolean;

  @IsOptional()
  @IsDate()
  joinedAt?: Date;
}

class DownGradeUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsOptional()
  @Type(() => TeamDto)
  teams?: TeamDto[];

  @IsArray()
  @Type(() => UserWorkspaceDto)
  @IsOptional()
  @ValidateNested({ each: true })
  workspaces?: UserWorkspaceDto[];
}

class DownGradeUserGenerateVariableDto extends DownGradeUserDto {
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  isGenerateVariableTrial?: string[];
}

export class DownGradeUserTourGuideDto extends DownGradeUserGenerateVariableDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TourGuideDto)
  tourGuide?: TourGuideDto;
}

export interface WorkspaceExcelDto {
  name: string;
  created_at: string;
  collections: number;
  testflow: number;
}

export interface UserExcelDto {
  name: string;
  email: string;
}

