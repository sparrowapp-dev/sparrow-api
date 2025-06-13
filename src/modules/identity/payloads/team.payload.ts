import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { WorkspaceDto } from "@src/modules/common/models/workspace.model";
import { UserDto } from "@src/modules/common/models/user.model";
import { Invite } from "@src/modules/common/models/team.model";
import { logoDto as TeamLogoDto } from "@src/modules/common/models/team.model";

export class logoDto {
  @IsString()
  @IsNotEmpty()
  bufferString: string;

  @IsString()
  @IsNotEmpty()
  encoding: string;

  @IsString()
  @IsNotEmpty()
  mimetype: string;

  @IsNumber()
  @IsNotEmpty()
  size: number;
}

export class CreateOrUpdateTeamDto {
  @ApiProperty({
    example: "team1",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "Description of Team",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  hubUrl?: string;

  @IsString()
  @IsOptional()
  githubUrl?: string;

  @IsString()
  @IsOptional()
  xUrl?: string;

  @IsString()
  @IsOptional()
  linkedinUrl?: string;

  @IsBoolean()
  @IsOptional()
  firstTeam?: boolean;

  @IsOptional()
  @IsObject()
  logo?: logoDto;
}

export class TeamDto {
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
  owner?: string;

  @IsArray()
  @IsOptional()
  admins?: string[];

  @IsArray()
  @IsOptional()
  invites?: Invite[];
}

export class UpdateTeamDto {
  @ApiProperty({
    example: "team1",
  })
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: "Description of Team",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: "github url",
  })
  @IsString()
  @IsOptional()
  githubUrl?: string;

  @ApiProperty({
    example: "x url",
  })
  @IsString()
  @IsOptional()
  xUrl?: string;

  @ApiProperty({
    example: "LinkedIn url",
  })
  @IsString()
  @IsOptional()
  linkedinUrl?: string;

  @IsOptional()
  @IsObject()
  logo?: logoDto;
}

export class ResponseTeam {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  hubUrl?: string;

  @IsString()
  @IsOptional()
  githubUrl?: string;

  @IsString()
  @IsOptional()
  xUrl?: string;

  @IsString()
  @IsOptional()
  linkedinUrl?: string;

  @IsOptional()
  @IsObject()
  logo?: TeamLogoDto;

  @IsArray()
  @Type(() => UserDto)
  @ValidateNested({ each: true })
  users: UserDto[];

  @IsArray()
  @IsNotEmpty()
  owner: string;

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

export class GetTeamDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  hubUrl?: string;

  @IsString()
  @IsOptional()
  githubUrl?: string;

  @IsString()
  @IsOptional()
  xUrl?: string;

  @IsString()
  @IsOptional()
  linkedinUrl?: string;

  @IsOptional()
  @IsObject()
  logo?: TeamLogoDto;

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
