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
}
