import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ObjectId } from "mongodb";

/**
 * Notification Types (extensible)
 */
export enum NotificationType {
  WORKSPACE_INVITE = "WORKSPACE_INVITE",
}

/**
 * Invite status
 */
export enum InviteStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

/**
 * Workspace role
 */
export enum WorkspaceRole {
  EDITOR = "editor",
  VIEWER = "viewer",
  ADMIN = "admin",
}

/**
 * Workspace Invite Notification Payload
 */
export class WorkspaceInviteNotificationData {
  @IsMongoId()
  inviterId: ObjectId;

  @IsString()
  inviterName: string;

  @IsString()
  teamId: string;

  @IsString()
  teamName: string;

  @IsArray()
  @IsMongoId({ each: true })
  workspaceIds: ObjectId[];

  @IsArray()
  @IsString({ each: true })
  workspaceNames: string[];

  @IsEnum(InviteStatus)
  inviteStatus: InviteStatus;

  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}

/**
 * Main Notification Model
 */
export class Notification {
  @IsMongoId()
  @IsOptional()
  _id?: ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  recipientId: ObjectId;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsObject()
  @ValidateNested()
  @Type(() => WorkspaceInviteNotificationData)
  data: WorkspaceInviteNotificationData;

  @IsBoolean()
  isRead: boolean;

  @IsBoolean()
  isArchived: boolean;

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;
}

/**
 * MongoDB Indexes Required
 *
 * 1. { recipientId: 1, isArchived: 1, createdAt: -1 }
 * 2. { recipientId: 1, isRead: 1, isArchived: 1 }
 */
