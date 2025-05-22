import { Injectable, Inject } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";

@Injectable()
export class AdminHubsRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async findTeamsByUserId(
    userId: string,
    skip?: number,
    limit?: number,
    search?: string,
    sortBy: string = "createdAt",
    sortOrder: string = "desc",
  ) {
    const userObjectId = new ObjectId(userId);

    // Build query
    let queryConditions: any = {
      $or: [{ "users.id": userObjectId }, { "users.id": userId.toString() }],
    };

    if (search?.trim()) {
      queryConditions = {
        $and: [
          {
            $or: [
              { "users.id": userObjectId },
              { "users.id": userId.toString() },
            ],
          },
          {
            $or: [{ name: { $regex: search.trim(), $options: "i" } }],
          },
        ],
      };
    }

    const collection = this.db.collection("team");
    const query = collection.find(queryConditions).sort({
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    });

    const totalCount = await collection.countDocuments(queryConditions);

    // Pagination
    if (typeof skip === "number" && typeof limit === "number") {
      const data = await query.skip(skip).limit(limit).toArray();
      return {
        data,
        pagination: {
          total: totalCount,
          currentPage: Math.floor(skip / limit) + 1,
          totalPages: Math.ceil(totalCount / limit),
          limit,
        },
        sort: { sortBy, sortOrder },
      };
    }

    // No pagination
    const data = await query.toArray();
    return {
      data,
      pagination: {
        total: totalCount,
        currentPage: 1,
        totalPages: 1,
        limit: totalCount,
      },
      sort: { sortBy, sortOrder },
    };
  }

  async findBasicTeamsByUserId(userId: string) {
    const userObjectId = new ObjectId(userId);
    const userIdStr = userId.toString();
    const teams = await this.db
      .collection("team")
      .find({
        users: {
          $elemMatch: {
            $or: [
              { id: userObjectId }, // case where id is stored as ObjectId
              { id: userIdStr }, // case where id is stored as string
            ],
          },
        },
      })
      .toArray();

    return teams;
  }

  async findHubById(hubId: string) {
    return this.db.collection("team").findOne({ _id: new ObjectId(hubId) });
  }
}
