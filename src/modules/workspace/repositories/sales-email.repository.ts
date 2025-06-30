import { Inject, Injectable } from "@nestjs/common";

import { Db, InsertOneResult, ObjectId, WithId } from "mongodb";
// ---- Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";

// ---- Model and Payload
import { SalesEmail } from "@src/modules/common/models/sales-email.model";

/**
 * Repository class for Sales Email Record operations.
 *
 * This class handles database interactions for sales email records,
 * including adding, retrieving, updating, and deleting sales email records.
 */
@Injectable()
export class SalesEmailRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Adds a new record of sales email in database.
   *
   * @param data - Record to be added.
   * @returns Result of the insert operation.
   */
  async addSalesEmailData(
    data: SalesEmail,
  ): Promise<InsertOneResult<SalesEmail>> {
    const response = await this.db
      .collection<SalesEmail>(Collections.SALESEMAIL)
      .insertOne(data);
    return response;
  }

  /**
   * Retrieves a record by its ID.
   *
   * @param id - Id of the record.
   * @returns The feature with the specified name.
   */
  async getSalesEmailRecordById(id: string): Promise<WithId<SalesEmail>> {
    const data = await this.db
      .collection<SalesEmail>(Collections.SALESEMAIL)
      .findOne({ _id: new ObjectId(id) });
    return data;
  }
}
