import { Injectable, Inject } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { Collections } from "src/modules/common/enum/database.collection.enum";

@Injectable()
export class AdminAuthRepository {
  constructor(@Inject("DATABASE_CONNECTION") private readonly db: Db) {}

  async addRefreshTokenInUser(
    _id: ObjectId,
    refreshToken: string,
  ): Promise<void> {
    await this.db.collection(Collections.USER).findOneAndUpdate(
      { _id },
      {
        $set: {
          admin_refresh_tokens: [refreshToken],
        },
      },
    );
  }

  async verifyRefreshToken(
    userId: ObjectId,
    hashedToken: string,
  ): Promise<boolean> {
    const user = await this.db.collection(Collections.USER).findOne({
      _id: userId,
      admin_refresh_tokens: hashedToken,
    });

    return !!user;
  }

  /**
   * Update refresh token (replace old with new)
   */
  async updateRefreshToken(
    userId: ObjectId,
    oldToken: string,
    newToken: string,
  ): Promise<any> {
    return this.db.collection(Collections.USER).updateOne(
      { _id: userId, admin_refresh_tokens: oldToken },
      {
        $set: {
          "admin_refresh_tokens.$": newToken,
        },
      },
    );
  }

  async findUserById(_id: ObjectId): Promise<any> {
    const user = await this.db.collection(Collections.USER).findOne({ _id });
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }
}
