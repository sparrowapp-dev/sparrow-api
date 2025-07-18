import { Injectable, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db } from "mongodb";
import {
  BillingEventDto,
  BillingTransactionDto,
} from "@src/modules/common/models/billing.model";

/**
 * Repository for handling billing audit database operations
 */
@Injectable()
export class BillingAuditRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Record a billing event - the core method for audit trail
   */
  async recordBillingEvent(
    eventData: Partial<BillingEventDto>,
  ): Promise<string> {
    const event: BillingEventDto = {
      ...eventData,
      timestamp: new Date(),
      version: 1,
    } as BillingEventDto;

    const result = await this.db
      .collection(Collections.BILLING_EVENTS)
      .insertOne(event);

    return result.insertedId.toString();
  }

  /**
   * Record a financial transaction
   */
  async recordTransaction(
    transactionData: Partial<BillingTransactionDto>,
  ): Promise<string> {
    const transaction: BillingTransactionDto = {
      ...transactionData,
      timestamp: new Date(),
    } as BillingTransactionDto;

    const result = await this.db
      .collection(Collections.BILLING_TRANSACTIONS)
      .insertOne(transaction);

    return result.insertedId.toString();
  }
}
