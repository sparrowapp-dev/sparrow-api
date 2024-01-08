import { ApiProperty } from "@nestjs/swagger";
import { UserDto } from "@src/modules/common/models/user.model";
import { WorkspaceDto } from "@src/modules/common/models/workspace.model";
import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsMongoId,
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
} from "class-validator";

export class CreateOrUpdateTeamUserDto {
  @ApiProperty({ example: "64f03af32e420f7f68055b92" })
  @IsMongoId()
  @IsNotEmpty()
  teamId: string;

  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ example: "64f03af32e420f7f68055b92" })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @IsMongoId()
  @IsOptional()
  workspaceId?: string;
}

export class CreateOrUpdateTeamUserResponseDto {
  @IsMongoId()
  @IsNotEmpty()
  @IsOptional()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @Type(() => WorkspaceDto)
  @IsOptional()
  workspaces?: WorkspaceDto[];

  @IsArray()
  @Type(() => UserDto)
  @IsOptional()
  users?: UserDto[];

  @IsArray()
  @IsOptional()
  owners?: string[];

  @IsMongoId()
  @IsNotEmpty()
  @IsOptional()
  createdBy?: string;

  @IsDateString()
  @IsOptional()
  createdAt?: Date;

  @IsDateString()
  @IsOptional()
  updatedAt?: Date;
}
