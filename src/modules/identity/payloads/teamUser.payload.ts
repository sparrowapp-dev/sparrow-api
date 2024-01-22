import { ApiProperty } from "@nestjs/swagger";
import { User, UserDto } from "@src/modules/common/models/user.model";
import { WorkspaceDto } from "@src/modules/common/models/workspace.model";
import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsMongoId,
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  ValidateNested,
} from "class-validator";

export class CreateOrUpdateTeamUserDto {
  @ApiProperty({ example: "64f03af32e420f7f68055b92" })
  @IsMongoId()
  @IsNotEmpty()
  teamId: string;

  @ApiProperty({ example: "64f03af32e420f7f68055b92" })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;
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

export class SelectedWorkspaces {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: "64f03af32e420f7f68055b92" })
  id: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: "MY Workspace" })
  name: string;
}

export class AddTeamUserDto {
  @IsMongoId()
  @IsOptional()
  teamId?: string;

  @IsArray()
  @ApiProperty({ example: ["user@gmail.com"] })
  users: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: "admin" })
  role: string;

  @IsArray()
  @IsOptional()
  @Type(() => SelectedWorkspaces)
  @ApiProperty({ type: [SelectedWorkspaces] })
  @ValidateNested({ each: true })
  workspaces?: SelectedWorkspaces[];
}

export class TeamInviteMailDto {
  @IsArray()
  @IsNotEmpty()
  @Type(() => User)
  users: User[];

  @IsString()
  @IsNotEmpty()
  teamName: string;
}
