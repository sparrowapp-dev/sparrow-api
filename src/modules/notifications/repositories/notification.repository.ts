import { Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult, ObjectId, UpdateResult } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Notification } from "@src/modules/common/models/notification.model";

@Injectable()
export class NotificationRepository {
  constructor(
    @Inject("DATABASE_CONNECTION")
    private readonly db: Db,
  ) {}

  /**
   * Create notification
   */
  async create(notification: Notification): Promise<InsertOneResult> {
    notification.createdAt = new Date();
    notification.updatedAt = new Date();
    notification.isRead = false;
    notification.isArchived = false;

    return this.db
      .collection<Notification>(Collections.NOTIFICATIONS)
      .insertOne(notification);
  }

  /**
   * Get notifications for a user
   */
  async findByRecipient(
    recipientId: ObjectId,
    includeArchived = false,
    limit = 20,
    skip = 0,
  ): Promise<Notification[]> {
    return this.db
      .collection<Notification>(Collections.NOTIFICATIONS)
      .find({
        recipientId,
        ...(includeArchived ? {} : { isArchived: false }),
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: ObjectId): Promise<UpdateResult> {
    return this.db
      .collection<Notification>(Collections.NOTIFICATIONS)
      .updateOne(
        { _id: notificationId },
        { $set: { isRead: true, updatedAt: new Date() } },
      );
  }

  /**
   * Archive notification
   */
  async archive(notificationId: ObjectId): Promise<UpdateResult> {
    return this.db
      .collection<Notification>(Collections.NOTIFICATIONS)
      .updateOne(
        { _id: notificationId },
        { $set: { isArchived: true, updatedAt: new Date() } },
      );
  }

  async countByRecipient(
    recipientId: ObjectId,
    includeArchived = false,
  ): Promise<number> {
    return this.db
      .collection<Notification>(Collections.NOTIFICATIONS)
      .countDocuments({
        recipientId,
        ...(includeArchived ? {} : { isArchived: false }),
      });
  }

  async markAllAsRead(userId: ObjectId) {
    return this.db
      .collection(Collections.NOTIFICATIONS)
      .updateMany(
        { recipientId: userId, isRead: false },
        { $set: { isRead: true, updatedAt: new Date() } },
      );
  }

  async updateInviteStatus(
    notificationId: ObjectId,
    status: "accepted" | "rejected",
  ): Promise<UpdateResult> {
    return this.db.collection(Collections.NOTIFICATIONS).updateOne(
      { _id: notificationId },
      {
        $set: {
          "data.inviteStatus": status,
          isRead: true,
          isArchived: true,
          updatedAt: new Date(),
        },
      },
    );
  }

  async findById(notificationId: ObjectId): Promise<Notification | null> {
    return this.db
      .collection<Notification>(Collections.NOTIFICATIONS)
      .findOne({ _id: notificationId });
  }

  async findPendingInvite(email: string, teamId: string) {
    return this.db.collection(Collections.NOTIFICATIONS).findOne({
      "data.teamId": teamId,
      "data.inviteStatus": "pending",
    });
  }
}
