import { Inject, Injectable } from "@nestjs/common";
import { Db, InsertOneResult, UpdateResult } from "mongodb";
import {
  CreateInviteUser,
  UpdateInviteUser,
} from "../payloads/userInvites.payload";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { UserInvites } from "@src/modules/common/models/user-invites.model";

@Injectable()
export class UserInvitesRepository {
  constructor(
    @Inject("DATABASE_CONNECTION")
    private readonly db: Db,
  ) {}

  /**
   * Creates a new unregistered user in the database
   * @param payload {CreateInviteUser}
   * @returns {Promise<InsertOneResult>} result of the insert operation
   */
  async create(payload: CreateInviteUser): Promise<InsertOneResult> {
    const { email, teamIds } = payload;
    const UserInvites = {
      email,
      teamIds,
      createdAt: new Date(),
    };
    const result = await this.db
      .collection<UserInvites>(Collections.USERINVITES)
      .insertOne(UserInvites);
    return result;
  }

  /**
   * Updates a non-user's teamIds by pushing all provided teamIds
   * @param payload {UpdateInviteUser}
   * @returns {Promise<UpdateResult>}
   */
  async update(payload: UpdateInviteUser): Promise<UpdateResult | any> {
    const { email, teamIds } = payload;
    if (teamIds.length === 0) {
      const reponse = await this.removeByEmail(email);
      return reponse;
    }
    const result = await this.db
      .collection<UserInvites>(Collections.USERINVITES)
      .updateOne({ email }, { $set: { teamIds: teamIds } });
    return result;
  }

  /**
   * Retrieves a non-user by their email
   * @param email {string}
   * @returns {Promise<UserInvites | null>}
   */
  async getByEmail(email: string): Promise<UserInvites | null> {
    return this.db
      .collection<UserInvites>(Collections.USERINVITES)
      .findOne({ email });
  }

  /**
   * Removes a user invite completely by email
   * @param email {string}
   * @returns {Promise<any>}
   */
  async removeByEmail(email: string): Promise<any> {
    const result = await this.db
      .collection<UserInvites>(Collections.USERINVITES)
      .deleteOne({ email });
    return result;
  }
}
