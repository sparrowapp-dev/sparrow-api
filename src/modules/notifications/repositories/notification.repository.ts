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

  /**
   * Fetch pending workspace invite notifications for a list of users within a time range.
   * Returns a Map keyed by userId (string) with an array of formatted messages.
   */
  async getPendingInvitesForUsers(
    userIds: string[],
    start: Date,
    end: Date,
  ): Promise<Map<string, string[]>> {
    if (!userIds || userIds.length === 0) return new Map();

    const objectIds = userIds.map((id) => new ObjectId(id));

    const pipeline = [
      {
        $match: {
          recipientId: { $in: objectIds },
          type: "WORKSPACE_INVITE",
          "data.inviteStatus": "pending",
          createdAt: { $gte: start, $lte: end },
          isArchived: false,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$recipientId",
          invites: {
            $push: {
              inviterName: "$data.inviterName",
              workspaceNames: "$data.workspaceNames",
              role: "$data.role",
              teamName: "$data.teamName",
            },
          },
        },
      },
      // Keep only the latest 5 invites per recipient for compactness
      {
        $project: {
          invites: { $slice: ["$invites", 5] },
        },
      },
    ];

    const results = await this.db
      .collection(Collections.NOTIFICATIONS)
      .aggregate(pipeline)
      .toArray();

    const map = new Map<string, string[]>();

    for (const row of results) {
      const key = row._id.toString();
      const messages: string[] = [];
      for (const inv of row.invites || []) {
        const inviter = inv?.inviterName || "Someone";

        if (inv?.role === "admin") {
          const teamName = inv?.teamName || "team";
          messages.push(`${inviter} invited you as admin to ${teamName}`);
        } else {
          const workspaceNames = Array.isArray(inv?.workspaceNames)
            ? inv.workspaceNames
            : inv?.workspaceNames
              ? [inv.workspaceNames]
              : [];

          const workspaceText =
            workspaceNames.length > 0
              ? workspaceNames.join(", ")
              : "a workspace";

          messages.push(`${inviter} invited you to ${workspaceText}`);
        }
      }
      map.set(key, messages);
    }

    return map;
  }
}
