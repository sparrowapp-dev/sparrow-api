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
  ValidateNested,
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

/**
 * DTO representing a user with a specific role in the workspace.
 */
export class UsersWithRolesDto {
  /**
   * The role assigned to the user in the workspace.
   */
  @ApiProperty({
    example: WorkspaceRole.EDITOR,
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  /**
   * The email of the user being added to the workspace.
   */
  @ApiProperty({ example: "user@gmail.com" })
  @IsString()
  @IsNotEmpty()
  user: string;
}

/**
 * DTO for adding multiple users with specific roles to a workspace.
 */
export class AddUsersWithRolesInWorkspaceDto {
  /**
   * Array of users and their respective roles to be added to the workspace.
   *
   * @example [
   *   { role: WorkspaceRole.EDITOR, user: "user1@gmail.com" },
   *   { role: WorkspaceRole.ADMIN, user: "user2@gmail.com" }
   * ]
   */
  @ApiProperty({ example: [UsersWithRolesDto] })
  @IsArray()
  @Type(() => UsersWithRolesDto)
  @ValidateNested({ each: true })
  users: UsersWithRolesDto[];
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

/**
 * DTO representing a user with an assigned role, extending the User class.
 */
export class UserWithRoleDto extends User {
  /**
   * The role assigned to the user.
   */
  @IsString()
  @IsNotEmpty()
  role: string;
}

/**
 * DTO for sending a workspace invitation email with roles for each user.
 */
export class WorkspaceInviteMailWIthRoleDto {
  /**
   * Array of users with their respective roles.
   *
   * @example [
   *   { role: "admin", email: "admin@example.com" },
   *   { role: "editor", email: "editor@example.com" }
   * ]
   */
  @IsArray()
  @IsNotEmpty()
  @Type(() => UserWithRoleDto)
  users: UserWithRoleDto[];

  /**
   * The name of the workspace for which users are invited.
   */
  @IsString()
  @IsNotEmpty()
  workspaceName: string;
}
