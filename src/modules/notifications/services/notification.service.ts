import { Injectable } from "@nestjs/common";
import { Inject, forwardRef } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { NotificationRepository } from "../repositories/notification.repository";
import {
  Notification,
  NotificationType,
  WorkspaceInviteNotificationData,
  InviteStatus,
  WorkspaceRole,
} from "@src/modules/common/models/notification.model";
import { TeamUserService } from "@src/modules/identity/services/team-user.service";

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    @Inject(forwardRef(() => TeamUserService))
    private readonly teamUserService: TeamUserService,
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

  async getUserNotifications(
    userId: ObjectId,
    page: number,
    limit: number,
    includeArchived: boolean,
  ) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.notificationRepository.findByRecipient(
        userId,
        includeArchived,
        limit,
        skip,
      ),
      this.notificationRepository.countByRecipient(userId, includeArchived),
    ]);

    return {
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsRead(notificationId: string) {
    return this.notificationRepository.markAsRead(new ObjectId(notificationId));
  }

  async archive(notificationId: string) {
    return this.notificationRepository.archive(new ObjectId(notificationId));
  }

  async markAllAsRead(userId: ObjectId) {
    return this.notificationRepository.markAllAsRead(userId);
  }

  async respondToWorkspaceInvite(
    notificationId: string,
    action: "accept" | "reject",
    userEmail: string,
  ) {
    const objectId = new ObjectId(notificationId);

    const notification = await this.notificationRepository.findById(objectId);

    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.data.inviteStatus !== "pending") {
      throw new Error("Invite already responded");
    }

    const data = notification.data;

    if (action === "accept") {
      // existing business logic
      await this.teamUserService.acceptInvite(data.teamId, userEmail);

      await this.notificationRepository.updateInviteStatus(
        objectId,
        "accepted",
      );
    }

    if (action === "reject") {
      // remove invite from team
      await this.teamUserService.removeInviteUser(data.teamId, userEmail);

      await this.notificationRepository.updateInviteStatus(
        objectId,
        "rejected",
      );
    }

    return true;
  }
}
