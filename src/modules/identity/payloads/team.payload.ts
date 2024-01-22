import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";
import { WorkspaceDto } from "@src/modules/common/models/workspace.model";
import { UserDto } from "@src/modules/common/models/user.model";

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
}
