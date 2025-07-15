import { Injectable, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import {
  BillingEventType,
  BillingEntityType,
  BillingTransactionType,
  BillingActorType,
  BillingSource,
} from "@src/modules/common/enum/billing.enum";
import { Db } from "mongodb";

/**
 * Interface for billing event data - only stores what changed
 */
export interface BillingEventData {
  eventType: BillingEventType;
  entityType: BillingEntityType;
  entityId: string;

  // What changed - only the delta, not full objects
  changes: {
    field: string;
    previousValue: any;
    newValue: any;
  }[];

  // Business context
  context: {
    actor: {
      type: BillingActorType;
      id?: string;
      name?: string;
    };
    reason?: string;
    source: BillingSource;
    correlationId?: string; // Links related events
    externalId?: string; // Stripe event ID, etc.
  };

  // Financial impact (if applicable)
  financialImpact?: {
    amount: number;
    currency: string;
    transactionType: BillingTransactionType;
  };

  // Metadata for specific event types
  metadata?: Record<string, any>;

  timestamp: Date;
  version: number; // For schema evolution
}

/**
 * Interface for billing transactions - separate from events
 */
export interface BillingTransaction {
  entityType: BillingEntityType;
  entityId: string;
  transactionType: BillingTransactionType;
  amount: number;
  currency: string;
  description: string;

  // References
  externalTransactionId?: string; // Stripe event ID, etc.
  invoiceId?: string;
  subscriptionId?: string;

  // Context
  eventId?: string; // Links to the event that caused this transaction

  timestamp: Date;
  processingError?: string;
}

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
    eventData: Partial<BillingEventData>,
  ): Promise<string> {
    const event: BillingEventData = {
      ...eventData,
      timestamp: new Date(),
      version: 1,
    } as BillingEventData;

    const result = await this.db
      .collection(Collections.BILLING_EVENTS)
      .insertOne(event);

    return result.insertedId.toString();
  }

  /**
   * Record a financial transaction
   */
  async recordTransaction(
    transactionData: Partial<BillingTransaction>,
  ): Promise<string> {
    const transaction: BillingTransaction = {
      ...transactionData,
      timestamp: new Date(),
    } as BillingTransaction;

    const result = await this.db
      .collection(Collections.BILLING_TRANSACTIONS)
      .insertOne(transaction);

    return result.insertedId.toString();
  }
}
