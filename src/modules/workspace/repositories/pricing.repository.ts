import { Inject, Injectable } from "@nestjs/common";

import { Db, InsertOneResult, ObjectId, WithId } from "mongodb";
// ---- Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";

// ---- Model and Payload
import { SalesEmail } from "@src/modules/common/models/sales-email.model";
import { Pricing } from "@src/modules/common/models/pricing.model";

/**
 * Repository class for Sales Email Record operations.
 *
 * This class handles database interactions for sales email records,
 * including adding, retrieving, updating, and deleting sales email records.
 */
@Injectable()
export class PricingRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Retrieves the only pricing object from the pricing collection.
   *
   * @returns The first pricing record found.
   */
  async getLatestPricing(): Promise<WithId<Pricing> | null> {
    const data = await this.db
      .collection<Pricing>(Collections.PRICING)
      .findOne({});
    return data;
  }
}
