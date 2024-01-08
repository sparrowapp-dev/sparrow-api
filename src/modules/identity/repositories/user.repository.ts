import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult, ObjectId, WithId } from "mongodb";
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
        password: createHmac("sha256", payload.password).digest("hex"),
        teams: [],
        personalWorkspaces: [],
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
    payload: UpdateUserDto,
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
    updateParams: UserDto,
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
    await this.db.collection<User>(Collections.USER).findOneAndUpdate(
      { _id },
      {
        $push: {
          refresh_tokens: refreshToken,
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
      refresh_tokens: [],
      personalWorkspaces: [],
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
}
