import { ApiProperty } from "@nestjs/swagger";
import { WorkspaceRole } from "@src/modules/common/enum/roles.enum";
import { User } from "@src/modules/common/models/user.model";
import { Type } from "class-transformer";
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class AddWorkspaceUserDto {
  @IsArray()
  @ApiProperty({ example: ["user@gmail.com"] })
  users: string;

  @ApiProperty({
    example: WorkspaceRole.EDITOR,
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class AddUserInWorkspaceDto {
  @ApiProperty({
    example: WorkspaceRole.EDITOR,
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @IsArray()
  @ApiProperty({ example: ["user@gmail.com"] })
  users: string;

  @ApiProperty()
  @IsMongoId()
  @IsOptional()
  workspaceId?: string;
}

export class removeUserFromWorkspaceDto {
  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;
}

export class UserWorkspaceRoleDto {
  @ApiProperty({
    example: WorkspaceRole.EDITOR,
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class UserRoleInWorkspcaeDto {
  @ApiProperty({
    example: WorkspaceRole.EDITOR,
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty()
  @IsMongoId()
  @IsOptional()
  userId?: string;

  @ApiProperty()
  @IsMongoId()
  @IsOptional()
  workspaceId?: string;
}

export class WorkspaceInviteMailDto {
  @IsArray()
  @IsNotEmpty()
  @Type(() => User)
  users: User[];

  @IsString()
  @IsNotEmpty()
  workspaceName: string;
}
