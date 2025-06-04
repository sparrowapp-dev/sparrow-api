import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult, ModifyResult, ObjectId, WithId } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { createHmac } from "crypto";
import { RegisterPayload } from "../payloads/register.payload";
import { UpdateUserDto, UserDto } from "../payloads/user.payload";
import {
  EarlyAccessEmail,
  EmailServiceProvider,
  User,
} from "@src/modules/common/models/user.model";
import { ContextService } from "@src/modules/common/services/context.service";

export interface IGenericMessageBody {
  message: string;
}

/**
 * User Repository
 */
@Injectable()
export class UserRepository {
  constructor(
    @Inject("DATABASE_CONNECTION")
    private db: Db,
    private readonly contextService: ContextService,
  ) {}

  async updateLastActiveQuietly(userId: string): Promise<void> {
    try {
      const _id = new ObjectId(userId);

      await this.db.collection<User>(Collections.USER).updateOne(
        { _id },
        {
          $set: {
            lastActive: new Date(),
          },
        },
      );
    } catch (error) {
      // Just log the error but don't throw to avoid interrupting request flow
      console.error(
        `Silent lastActive update failed for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Fetches a user from database by UUID
   * @param {string} id
   * @returns {Promise<IUser>} queried user data
   */
  async getUserById(id: string): Promise<WithId<User>> {
    const authUser = this.contextService.get("user");
    if (authUser._id.toString() === id) {
      return authUser;
    }
    const _id = new ObjectId(id);
    const data = await this.db
      .collection<User>(Collections.USER)
      .findOne(
        { _id },
        { projection: { password: 0, verificationCode: 0, refresh_tokens: 0 } },
      );
    return data;
  }

  /**
   * Fetches a user from database by username
   * @param {string} email
   * @returns {Promise<IUser>} queried user data
   */
  async getUserByEmail(email: string): Promise<WithId<User>> {
    return await this.db
      .collection<User>(Collections.USER)
      .findOne({ email }, { projection: { password: 0 } });
  }

  /**
   * Fetches a user by their email and hashed password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<IUser>} queried user data
   */
  async getUserByEmailAndPass(email: string, password: string) {
    return await this.db.collection<User>(Collections.USER).findOne({
      email,
      password: createHmac("sha256", password).digest("hex"),
    });
  }

  /**
   * Create a user with RegisterPayload fields
   * @param {RegisterPayload} payload user payload
   * @returns {Promise<IUser>} created user data
   */
  async createUser(payload: RegisterPayload): Promise<InsertOneResult<User>> {
    const createdUser = await this.db
      .collection<User>(Collections.USER)
      .insertOne({
        ...payload,
        isEmailVerified: false,
        password: createHmac("sha256", payload.password).digest("hex"),
        teams: [],
        workspaces: [],
      });
    const user = {
      _id: createdUser.insertedId,
      name: payload.name,
      email: payload.email,
    };
    this.contextService.set("user", user);

    return createdUser;
  }

  /**
   * Edit User data
   * @param {userId} payload
   * @param {UpdateUserDto} payload
   * @returns {Promise<IUser>} mutated User data
   */
  async updateUser(
    userId: string,
    payload: Partial<UpdateUserDto>,
  ): Promise<WithId<User>> {
    const _id = new ObjectId(userId);
    const updatedUser = await this.db
      .collection<User>(Collections.USER)
      .updateOne({ _id }, { $set: payload });
    if (!updatedUser.matchedCount) {
      throw new BadRequestException(
        "The user with that email does not exist in the system. Please try another username.",
      );
    }
    return this.getUserById(userId);
  }

  /**
   * Delete user given a email
   * @param {userId} param
   * @returns {Promise<IGenericMessageBody>}
   */
  async deleteUser(userId: string): Promise<IGenericMessageBody> {
    const _id = new ObjectId(userId);
    return this.db
      .collection<User>(Collections.USER)
      .deleteOne({ _id })
      .then((user) => {
        if (user.deletedCount === 1) {
          return { message: `Deleted ${userId} from records` };
        } else {
          throw new BadRequestException(
            `Failed to delete a user by the id of ${userId}.`,
          );
        }
      });
  }

  async findUserByUserId(id: ObjectId): Promise<WithId<User>> {
    const userData = await this.db
      .collection<User>(Collections.USER)
      .findOne({ _id: id });
    return userData;
  }

  async updateUserById(
    id: ObjectId,
    updateParams: Partial<UserDto>,
  ): Promise<WithId<User>> {
    const updatedUserParams = {
      $set: updateParams,
    };
    const responseData = await this.db
      .collection<User>(Collections.USER)
      .findOneAndUpdate({ _id: id }, updatedUserParams);
    return responseData.value;
  }
  async addRefreshTokenInUser(
    _id: ObjectId,
    refreshToken: string,
  ): Promise<void> {
    // Replacing old refresh tokens with the new token until refresh token flow is fixed. - Nayan (Feb 28,2024)
    await this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { _id },
      {
        $set: {
          refresh_tokens: [refreshToken],
        },
      },
    );
  }

  async deleteRefreshToken(id: string, refreshToken: string): Promise<void> {
    const _id = new ObjectId(id);
    await this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { _id },
      {
        $pull: {
          refresh_tokens: refreshToken,
        },
      },
    );
    return;
  }
  async createGoogleAuthUser(
    oAuthId: string,
    name: string,
    email: string,
  ): Promise<InsertOneResult> {
    const user: User = {
      name,
      email,
      teams: [],
      authProviders: [
        {
          name: EmailServiceProvider.GMAIL,
          oAuthId,
        },
      ],
      isEmailVerified: true,
      refresh_tokens: [],
      workspaces: [],
      createdAt: new Date(Date.now()),
      updatedAt: new Date(Date.now()),
    };
    return await this.db.collection<User>(Collections.USER).insertOne(user);
  }
  async saveEarlyAccessEmail(email: string): Promise<void> {
    await this.db
      .collection<EarlyAccessEmail>(Collections.EARLYACCESS)
      .insertOne({
        email,
        createdAt: new Date(Date.now()),
        updatedAt: new Date(Date.now()),
      });
  }
  async updateVerificationCode(
    email: string,
    verificationCode: string,
  ): Promise<void> {
    await this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { email },
      {
        $set: {
          verificationCode,
          verificationCodeTimeStamp: new Date(),
          isVerificationCodeActive: true,
        },
      },
    );
  }

  async updateEmailVerificationCode(
    email: string,
    emailVerificationCode: string,
  ): Promise<void> {
    await this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { email },
      {
        $set: {
          isEmailVerified: false,
          emailVerificationCode,
          emailVerificationCodeTimeStamp: new Date(),
        },
      },
    );
  }

  /**
   * Updates the user's Magic Code and timestamps in the database.
   *
   * @param email - The email address of the user whose Magic Code is being updated.
   * @param magicCode - The new Magic Code to be set for the user.
   * @param lastMagicCodeTimeStamp - The timestamp of the last Magic Code issuance.
   * @param secondLastMagicCodeTimeStamp - The timestamp of the second-to-last Magic Code issuance.
   * @returns A promise that resolves when the update operation is complete.
   */
  async updateMagicCode(
    email: string,
    magicCode: string,
    lastMagicCodeTimeStamp: Date,
    secondLastMagicCodeTimeStamp: Date,
  ): Promise<void> {
    await this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { email },
      {
        $set: {
          magicCode,
          secondLastMagicCodeTimeStamp: secondLastMagicCodeTimeStamp,
          lastMagicCodeTimeStamp: lastMagicCodeTimeStamp,
          magicCodeTimeStamp: new Date(),
        },
      },
    );
  }

  /**
   * Updates the user's occaisonal updates status in database.
   *
   * @param email - The email address of the user whose Magic Code is being updated.
   * @param isUserAcceptedOccasionalUpdates - Boolean value wheather user accepted or not.
   * @returns A promise that resolves when the update operation is complete.
   */
  async updateOccaisonalUpdates(
    email: string,
    isUserAcceptedOccasionalUpdates: boolean,
  ): Promise<ModifyResult<User>> {
    const data = this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { email },
      {
        $set: {
          isUserAcceptedOccasionalUpdates,
        },
      },
      { projection: { password: 0 } },
    );
    return data;
  }

  async expireVerificationCode(email: string): Promise<void> {
    await this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { email },
      {
        $set: {
          isVerificationCodeActive: false,
        },
      },
    );
  }

  async updatePassword(email: string, password: string): Promise<void> {
    await this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { email },
      {
        $set: {
          password: createHmac("sha256", password).digest("hex"),
        },
      },
    );
    return;
  }

  async findUsersByIdArray(IdArray: Array<ObjectId>): Promise<WithId<User>[]> {
    const response = await this.db
      .collection<User>(Collections.USER)
      .find({ _id: { $in: IdArray } })
      .toArray();
    return response;
  }

  async updateUserEmailVerificationStatus(email: string): Promise<void> {
    await this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { email },
      {
        $set: {
          isEmailVerified: true,
          emailVerificationCode: "",
        },
      },
    );
  }

  /**
   * Updates the Magic Code status of a user in the database.
   * This method clears the Magic Code and related timestamps, and marks the email as verified.
   *
   * @param email - The email address of the user whose Magic Code status is being updated.
   * @returns A promise that resolves when the update operation is complete.
   */
  async updateUserMagicCodeStatus(email: string): Promise<void> {
    await this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { email },
      {
        $set: {
          magicCode: "",
          magicCodeTimeStamp: null,
          lastMagicCodeTimeStamp: null,
          secondLastMagicCodeTimeStamp: null,
          isEmailVerified: true,
        },
      },
    );
  }
}
