import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { WorkspaceDto } from "@src/modules/common/models/workspace.model";
import { UserDto } from "@src/modules/common/models/user.model";
export class CreateOrUpdateTeamDto {
  @ApiProperty({
    example: "team1",
  })
  @IsString()
  @IsNotEmpty()
  name: string;
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
  owners?: string[];
}
