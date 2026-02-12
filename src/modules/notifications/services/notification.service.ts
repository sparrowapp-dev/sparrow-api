import { Injectable } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { NotificationRepository } from "../repositories/notification.repository";
import {
  Notification,
  NotificationType,
  WorkspaceInviteNotificationData,
  InviteStatus,
  WorkspaceRole,
} from "@src/modules/common/models/notification.model";

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  /**
   * Create notification when workspace invite batch is sent
   *
   * One invite batch → one notification
   */
  async createWorkspaceInviteNotification(params: {
    recipientId: ObjectId;
    inviterId: ObjectId;
    inviterName: string;
    teamId: string;
    teamName: string;
    workspaceIds: ObjectId[];
    workspaceNames: string[];
    role: WorkspaceRole;
  }) {
    const inviteData: WorkspaceInviteNotificationData = {
      inviterId: params.inviterId,
      inviterName: params.inviterName,
      teamId: params.teamId,
      teamName: params.teamName,
      workspaceIds: params.workspaceIds,
      workspaceNames: params.workspaceNames,
      inviteStatus: InviteStatus.PENDING,
      role: params.role,
    };

    const notification: Notification = {
      recipientId: params.recipientId,
      type: NotificationType.WORKSPACE_INVITE,
      data: inviteData,
      isRead: false,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.notificationRepository.create(notification);
  }
}
