import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { Db } from "mongodb";
import { ObjectId, WithId } from "mongodb";
import { User } from "@src/modules/common/models/user.model";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { DownGradeUserTourGuideDto } from "../payloads/downgrade-user.payload";

/**
 * Repository for handling promo code database operations
 */
@Injectable()
export class DownGradeUserRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}
  async findUserByUserId(id: ObjectId): Promise<WithId<User>> {
    const userData = await this.db
      .collection<User>(Collections.USER)
      .findOne({ _id: id });
    return userData;
  }

  async updateUserById(
    id: ObjectId,
    updateParams: Partial<DownGradeUserTourGuideDto>,
  ): Promise<WithId<User>> {
    const updatedUserParams = {
      $set: updateParams,
    };
    const responseData = await this.db
      .collection<User>(Collections.USER)
      .findOneAndUpdate({ _id: id }, updatedUserParams);
    return responseData.value;
  }

  async findUsersByIdArray(IdArray: Array<ObjectId>): Promise<WithId<User>[]> {
    const response = await this.db
      .collection<User>(Collections.USER)
      .find({ _id: { $in: IdArray } })
      .toArray();
    return response;
  }

  async findUsersByStringIds(ids: string[]): Promise<WithId<User>[]> {
    try {
      const objectIds = ids.map((id) => new ObjectId(id));
      const users = await this.db
        .collection<User>(Collections.USER)
        .find({ _id: { $in: objectIds } })
        .toArray();
      if (!users || users.length === 0) {
        return;
      }
      return users;
    } catch (error) {
      console.error("Error fetching users by string IDs:", error);
    }
  }
}
