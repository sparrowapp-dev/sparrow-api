import { Injectable } from "@nestjs/common";
import {
  BillingAuditRepository,
  BillingEventData,
  BillingTransaction,
} from "../repositories/billing-audit.repository";
import {
  BillingEventType,
  BillingEntityType,
  BillingTransactionType,
} from "@src/modules/common/enum/billing.enum";
import { PlanName } from "@src/modules/common/enum/plan.enum";

/**
 * Simplified billing audit service for internal logging only
 * No APIs - just structured event logging for audit trails
 */
@Injectable()
export class BillingAuditService {
  constructor(private readonly billingAuditRepo: BillingAuditRepository) {}

  /**
   * Record a billing event - the core method for audit trail
   */
  async recordBillingEvent(
    eventData: Partial<BillingEventData>,
  ): Promise<string> {
    return await this.billingAuditRepo.recordBillingEvent(eventData);
  }

  /**
   * Record a financial transaction
   */
  async recordTransaction(
    transactionData: Partial<BillingTransaction>,
  ): Promise<string> {
    return await this.billingAuditRepo.recordTransaction(transactionData);
  }

  /**
   * Record a subscription creation event
   */
  async recordSubscriptionCreated(
    entityId: string,
    planName: string,
    subscriptionDetails: any,
    context: BillingEventData["context"],
  ): Promise<string> {
    return await this.recordBillingEvent({
      eventType: BillingEventType.SUBSCRIPTION_CREATED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes: [
        {
          field: "subscription_status",
          previousValue: null,
          newValue: subscriptionDetails.status,
        },
        {
          field: "plan_name",
          previousValue: PlanName.COMMUNITY,
          newValue: planName,
        },
        {
          field: "seats",
          previousValue: subscriptionDetails.seats || 1,
          newValue: subscriptionDetails.seats || 1,
        },
        {
          field: "subscription_period_start",
          previousValue: null,
          newValue: subscriptionDetails.current_period_start || null,
        },
        {
          field: "subscription_period_end",
          previousValue: null,
          newValue: subscriptionDetails.current_period_end || null,
        },
        {
          field: "subscription_cycle",
          previousValue: null,
          newValue: subscriptionDetails.interval
            ? `${subscriptionDetails.interval_count || 1} ${subscriptionDetails.interval}`
            : "monthly",
        },
      ],
      context,
      metadata: {
        subscriptionId: subscriptionDetails.id,
        trialEnd: subscriptionDetails.trial_end,
        billingCycle: subscriptionDetails.billing_cycle,
        interval: subscriptionDetails.interval,
        intervalCount: subscriptionDetails.interval_count,
      },
    });
  }

  /**
   * Record a plan change event
   */
  async recordPlanChange(
    entityId: string,
    previousPlan: string,
    newPlan: string,
    context: BillingEventData["context"],
    seatChange?: { from: string; to: string },
    subscriptionDetails?: any,
  ): Promise<string> {
    const changes = [
      {
        field: "plan_name",
        previousValue: previousPlan,
        newValue: newPlan,
      },
    ];

    if (seatChange) {
      changes.push({
        field: "seats",
        previousValue: seatChange.from,
        newValue: seatChange.to,
      });
    }

    // Add subscription period changes if provided
    if (subscriptionDetails) {
      if (subscriptionDetails.current_period_start) {
        changes.push({
          field: "subscription_period_start",
          previousValue: null,
          newValue:
            subscriptionDetails.current_period_start instanceof Date
              ? subscriptionDetails.current_period_start
              : new Date(subscriptionDetails.current_period_start * 1000),
        });
      }

      if (subscriptionDetails.current_period_end) {
        changes.push({
          field: "subscription_period_end",
          previousValue: null,
          newValue:
            subscriptionDetails.current_period_end instanceof Date
              ? subscriptionDetails.current_period_end
              : new Date(subscriptionDetails.current_period_end * 1000),
        });
      }

      if (subscriptionDetails.interval) {
        changes.push({
          field: "subscription_cycle",
          previousValue: null,
          newValue: `${subscriptionDetails.interval_count || 1} ${subscriptionDetails.interval}`,
        });
      }
    }

    return await this.recordBillingEvent({
      eventType: BillingEventType.PLAN_CHANGED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes,
      context,
      metadata: {
        planTransition: `${previousPlan} -> ${newPlan}`,
        seatChange,
        subscriptionDetails: subscriptionDetails
          ? {
              interval: subscriptionDetails.interval,
              intervalCount: subscriptionDetails.interval_count,
              currentPeriodStart:
                subscriptionDetails.current_period_start instanceof Date
                  ? subscriptionDetails.current_period_start
                  : subscriptionDetails.current_period_start
                    ? new Date(subscriptionDetails.current_period_start * 1000)
                    : null,
              currentPeriodEnd:
                subscriptionDetails.current_period_end instanceof Date
                  ? subscriptionDetails.current_period_end
                  : subscriptionDetails.current_period_end
                    ? new Date(subscriptionDetails.current_period_end * 1000)
                    : null,
            }
          : undefined,
      },
    });
  }

  /**
   * Record a payment event
   */
  async recordPaymentEvent(
    entityId: string,
    success: boolean,
    amount: number,
    currency: string,
    context: BillingEventData["context"],
    metadata?: Record<string, any>,
  ): Promise<string> {
    const eventId = await this.recordBillingEvent({
      eventType: success
        ? BillingEventType.PAYMENT_SUCCEEDED
        : BillingEventType.PAYMENT_FAILED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes: [
        {
          field: "payment_status",
          previousValue: "pending",
          newValue: success ? "succeeded" : "failed",
        },
      ],
      context,
      financialImpact: success
        ? {
            amount,
            currency,
            transactionType: BillingTransactionType.CHARGE,
          }
        : undefined,
      metadata,
    });

    // Record transaction if payment succeeded
    if (success) {
      await this.recordTransaction({
        entityType: BillingEntityType.HUB,
        entityId,
        transactionType: BillingTransactionType.CHARGE,
        amount,
        currency,
        description: `Payment for subscription`,
        eventId,
        invoiceId: metadata?.invoiceId,
        subscriptionId: metadata?.subscriptionId,
      });
    }

    return eventId;
  }

  /**
   * Record a subscription renewal event
   */
  async recordSubscriptionRenewal(
    entityId: string,
    planName: string,
    renewalDetails: any,
    context: BillingEventData["context"],
  ): Promise<string> {
    const changes = [
      {
        field: "subscription_period_start",
        previousValue:
          renewalDetails.previous_period_start instanceof Date
            ? renewalDetails.previous_period_start
            : renewalDetails.previous_period_start
              ? new Date(renewalDetails.previous_period_start * 1000)
              : null,
        newValue:
          renewalDetails.current_period_start instanceof Date
            ? renewalDetails.current_period_start
            : new Date(renewalDetails.current_period_start * 1000),
      },
      {
        field: "subscription_period_end",
        previousValue:
          renewalDetails.previous_period_end instanceof Date
            ? renewalDetails.previous_period_end
            : renewalDetails.previous_period_end
              ? new Date(renewalDetails.previous_period_end * 1000)
              : null,
        newValue:
          renewalDetails.current_period_end instanceof Date
            ? renewalDetails.current_period_end
            : new Date(renewalDetails.current_period_end * 1000),
      },
      {
        field: "subscription_cycle",
        previousValue: renewalDetails.interval
          ? `${renewalDetails.interval_count || 1} ${renewalDetails.interval}`
          : "monthly",
        newValue: renewalDetails.interval
          ? `${renewalDetails.interval_count || 1} ${renewalDetails.interval}`
          : "monthly",
      },
      {
        field: "plan_name",
        previousValue: planName,
        newValue: planName, // Same plan for renewal
      },
      {
        field: "seats",
        previousValue: renewalDetails.seats?.toString() || "1",
        newValue: renewalDetails.seats?.toString() || "1", // Same seats for renewal
      },
    ];

    return await this.recordBillingEvent({
      eventType: BillingEventType.SUBSCRIPTION_RENEWED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes,
      context,
      financialImpact: {
        amount: renewalDetails.amount_billed || 0,
        currency: renewalDetails.currency || "usd",
        transactionType: BillingTransactionType.CHARGE,
      },
      metadata: {
        subscriptionId: renewalDetails.subscriptionId,
        planName,
        billingCycle: `${renewalDetails.interval_count || 1} ${renewalDetails.interval || "month"}`,
        previousPeriod: {
          start:
            renewalDetails.previous_period_start instanceof Date
              ? renewalDetails.previous_period_start
              : renewalDetails.previous_period_start
                ? new Date(renewalDetails.previous_period_start * 1000)
                : null,
          end:
            renewalDetails.previous_period_end instanceof Date
              ? renewalDetails.previous_period_end
              : renewalDetails.previous_period_end
                ? new Date(renewalDetails.previous_period_end * 1000)
                : null,
        },
        currentPeriod: {
          start:
            renewalDetails.current_period_start instanceof Date
              ? renewalDetails.current_period_start
              : new Date(renewalDetails.current_period_start * 1000),
          end:
            renewalDetails.current_period_end instanceof Date
              ? renewalDetails.current_period_end
              : new Date(renewalDetails.current_period_end * 1000),
        },
      },
    });
  }

  /**
   * Record a subscription canceled event
   */
  async recordSubscriptionCanceled(
    entityId: string,
    previousPlan: string,
    cancellationDetails: any,
    context: BillingEventData["context"],
  ): Promise<string> {
    const changes = [
      {
        field: "subscription_status",
        previousValue: "active",
        newValue: cancellationDetails.status || "canceled",
      },
      {
        field: "canceled_at",
        previousValue: null,
        newValue:
          cancellationDetails.canceled_at instanceof Date
            ? cancellationDetails.canceled_at
            : new Date(),
      },
    ];

    // Add period end date if available
    if (cancellationDetails.current_period_end) {
      changes.push({
        field: "subscription_end_date",
        previousValue: null,
        newValue:
          cancellationDetails.current_period_end instanceof Date
            ? cancellationDetails.current_period_end
            : new Date(cancellationDetails.current_period_end * 1000),
      });
    }

    return await this.recordBillingEvent({
      eventType: BillingEventType.SUBSCRIPTION_CANCELED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes,
      context,
      metadata: {
        subscriptionId: cancellationDetails.subscriptionId,
        cancellationReason:
          cancellationDetails.cancellation_reason || "unknown",
        effectiveDate:
          cancellationDetails.ended_at instanceof Date
            ? cancellationDetails.ended_at
            : cancellationDetails.ended_at
              ? new Date(cancellationDetails.ended_at * 1000)
              : new Date(),
      },
    });
  }
}
