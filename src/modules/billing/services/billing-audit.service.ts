import { Injectable } from "@nestjs/common";
import { BillingAuditRepository } from "../repositories/billing-audit.repository";
import {
  BillingEventType,
  BillingEntityType,
  BillingTransactionType,
  BillingActorType,
  BillingSource,
} from "@src/modules/common/enum/billing.enum";
import { PlanName } from "@src/modules/common/enum/plan.enum";
import {
  BillingEventDto,
  BillingTransactionDto,
} from "@src/modules/common/models/billing.model";
import { P } from "pino";
import { PaymentEventType } from "../gateways/stripe-webhook.gateway";

/**
 * Billing Audit Service - Enhanced with Hub Lifecycle Tracking
 *
 * This service provides comprehensive billing event logging including:
 *
 * Hub Lifecycle Events:
 * - HUB_CREATED: Records when a new hub/team is created (start of billing eligibility)
 * - HUB_LIMIT_UPDATED: Records when plan limits change for a hub (automatically triggered on plan changes)
 *
 * Usage Examples:
 *
 * 1. Hub Creation (automatically called in TeamService.create):
 *    await billingAuditService.recordHubCreated(hubId, hubName, planName, context, hubDetails);
 *
 * 2. Plan Changes (existing calls automatically track limit changes):
 *    await billingAuditService.recordPlanChange(hubId, oldPlan, newPlan, context, seatChange, subscriptionDetails, planLimits);
 *
 * Note: All existing recordPlanChange calls will automatically log HUB_LIMIT_UPDATED events when planLimits are provided.
 */
@Injectable()
export class BillingAuditService {
  constructor(private readonly billingAuditRepo: BillingAuditRepository) {}

  /**
   * Record a billing event - the core method for audit trail
   */
  async recordBillingEvent(
    eventData: Partial<BillingEventDto>,
  ): Promise<string> {
    return await this.billingAuditRepo.recordBillingEvent(eventData);
  }

  /**
   * Record a financial transaction
   */
  async recordTransaction(
    transactionData: Partial<BillingTransactionDto>,
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
    context: BillingEventDto["context"],
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
    context: BillingEventDto["context"],
    seatChange?: { from: string; to: string },
    subscriptionDetails?: any,
    planLimits?: { previous: Record<string, any>; new: Record<string, any> },
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

    const planChangeEventId = await this.recordBillingEvent({
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

    // Automatically record hub limit update if limits are provided
    if (planLimits && planLimits.previous && planLimits.new) {
      const limitChanges = this.extractPlanLimitChanges(
        planLimits.previous,
        planLimits.new,
      );

      if (limitChanges.length > 0) {
        await this.recordBillingEvent({
          eventType: BillingEventType.HUB_LIMIT_UPDATED,
          entityType: BillingEntityType.HUB,
          entityId,
          changes: limitChanges,
          context: {
            ...context,
            reason: `Plan change from ${previousPlan} to ${newPlan}`,
          },
          metadata: {
            planName: newPlan,
            previousPlan: previousPlan,
            limitsChanged: limitChanges.map((change) => change.field),
            triggeredBy: "plan_change",
          },
        });
      }
    }

    return planChangeEventId;
  }

  /**
   * Record a payment event
   */
  async recordPaymentEvent(
    entityId: string,
    success: boolean,
    amount: number,
    currency: string,
    context: BillingEventDto["context"],
    metadata?: Record<string, any>,
    status?: string,
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

    // Handle automatic dunning events
    if (!success && metadata?.invoiceId) {
      // Record dunning started for payment failures
      await this.recordDunningStarted(
        entityId,
        {
          invoiceId: metadata.invoiceId,
          attemptNumber: metadata.attemptNumber || 1,
        },
        context,
        { triggerredByPaymentFailure: true, ...metadata },
      );
    } else if (success && status === PaymentEventType.PAYMENT_FAILED) {
      // Record dunning resolved for successful payments that resolve dunning
      await this.recordDunningResolved(
        entityId,
        {
          invoiceId: metadata.invoiceId,
          totalAttempts: metadata.totalAttempts || 1,
          resolutionMethod: PaymentEventType.PAYMENT_SUCCESS,
          amount,
          currency,
        },
        context,
        { resolvedByPaymentSuccess: true, ...metadata },
      );
    }

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
   * Record a payment method added event
   */
  async recordPaymentMethodAdded(
    entityId: string,
    paymentMethodDetails: {
      paymentMethodId: string;
      type: string;
      brand?: string;
      last4?: string;
    },
    context: BillingEventDto["context"],
    metadata?: Record<string, any>,
  ): Promise<string> {
    return await this.recordBillingEvent({
      eventType: BillingEventType.PAYMENT_METHOD_ADDED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes: [
        {
          field: "payment_method",
          previousValue: null,
          newValue: {
            id: paymentMethodDetails.paymentMethodId,
            type: paymentMethodDetails.type,
            brand: paymentMethodDetails.brand,
            last4: paymentMethodDetails.last4,
          },
        },
      ],
      context,
      metadata: {
        paymentMethodId: paymentMethodDetails.paymentMethodId,
        paymentMethodType: paymentMethodDetails.type,
        ...metadata,
      },
    });
  }

  /**
   * Record dunning started event - when payment recovery process begins
   */
  async recordDunningStarted(
    entityId: string,
    dunningDetails: {
      invoiceId: string;
      attemptNumber: number;
      failureReason?: string;
      nextAttemptDate?: Date;
    },
    context: BillingEventDto["context"],
    metadata?: Record<string, any>,
  ): Promise<string> {
    return await this.recordBillingEvent({
      eventType: BillingEventType.DUNNING_STARTED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes: [
        {
          field: "dunning_status",
          previousValue: "none",
          newValue: "active",
        },
        {
          field: "payment_attempt_count",
          previousValue: dunningDetails.attemptNumber - 1,
          newValue: dunningDetails.attemptNumber,
        },
      ],
      context,
      metadata: {
        invoiceId: dunningDetails.invoiceId,
        attemptNumber: dunningDetails.attemptNumber,
        ...metadata,
      },
    });
  }

  /**
   * Record dunning resolved event - when payment recovery succeeds
   */
  async recordDunningResolved(
    entityId: string,
    resolutionDetails: {
      invoiceId: string;
      totalAttempts: number;
      resolutionMethod: string; // 'payment_succeeded' | 'manual_intervention' | 'subscription_updated'
      amount: number;
      currency: string;
    },
    context: BillingEventDto["context"],
    metadata?: Record<string, any>,
  ): Promise<string> {
    const eventId = await this.recordBillingEvent({
      eventType: BillingEventType.DUNNING_RESOLVED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes: [
        {
          field: "dunning_status",
          previousValue: "active",
          newValue: "resolved",
        },
        {
          field: "payment_status",
          previousValue: "failed",
          newValue: "succeeded",
        },
      ],
      context,
      financialImpact: {
        amount: resolutionDetails.amount,
        currency: resolutionDetails.currency,
        transactionType: BillingTransactionType.CHARGE,
      },
      metadata: {
        invoiceId: resolutionDetails.invoiceId,
        totalAttempts: resolutionDetails.totalAttempts,
        resolutionMethod: resolutionDetails.resolutionMethod,
        ...metadata,
      },
    });

    // Record transaction for successful dunning resolution
    await this.recordTransaction({
      entityType: BillingEntityType.HUB,
      entityId,
      transactionType: BillingTransactionType.CHARGE,
      amount: resolutionDetails.amount,
      currency: resolutionDetails.currency,
      description: `Payment recovered after ${resolutionDetails.totalAttempts} attempts`,
      eventId,
      invoiceId: resolutionDetails.invoiceId,
    });

    return eventId;
  }

  /**
   * Record a subscription renewal event
   */
  async recordSubscriptionRenewal(
    entityId: string,
    planName: string,
    renewalDetails: any,
    context: BillingEventDto["context"],
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
    context: BillingEventDto["context"],
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

  /**
   * Record a trial started event
   */
  async recordTrialStarted(
    entityId: string,
    planName: string,
    trialDetails: {
      trialEndDate: Date;
      seats?: number;
    },
    context: BillingEventDto["context"],
    metadata?: Record<string, any>,
  ): Promise<string> {
    return await this.recordBillingEvent({
      eventType: BillingEventType.TRIAL_STARTED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes: [
        {
          field: "in_trial",
          previousValue: false,
          newValue: true,
        },
        {
          field: "trial_end_date",
          previousValue: null,
          newValue: trialDetails.trialEndDate,
        },
        {
          field: "plan_name",
          previousValue: null,
          newValue: planName,
        },
      ],
      context,
      metadata: {
        trialEndDate: trialDetails.trialEndDate,
        seats: trialDetails.seats || 1,
        planName,
        ...metadata,
      },
    });
  }

  /**
   * Record a trial expired event
   */
  async recordTrialExpired(
    entityId: string,
    planName: string,
    trialDetails: {
      trialEndDate: Date;
      seats?: number;
    },
    context: BillingEventDto["context"],
    metadata?: Record<string, any>,
  ): Promise<string> {
    return await this.recordBillingEvent({
      eventType: BillingEventType.TRIAL_EXPIRED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes: [
        {
          field: "in_trial",
          previousValue: true,
          newValue: false,
        },
        {
          field: "trial_status",
          previousValue: "active",
          newValue: "expired",
        },
      ],
      context,
      metadata: {
        trialEndDate: trialDetails.trialEndDate,
        seats: trialDetails.seats || 1,
        planName,
        ...metadata,
      },
    });
  }

  /**
   * Record a trial converted event
   */
  async recordTrialConverted(
    entityId: string,
    planName: string,
    conversionDetails: {
      trialEndDate: Date;
      seats?: number;
      amount?: number;
      currency?: string;
    },
    context: BillingEventDto["context"],
    metadata?: Record<string, any>,
  ): Promise<string> {
    const eventId = await this.recordBillingEvent({
      eventType: BillingEventType.TRIAL_CONVERTED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes: [
        {
          field: "in_trial",
          previousValue: true,
          newValue: false,
        },
        {
          field: "billing_type",
          previousValue: "trial",
          newValue: "paid",
        },
        {
          field: "trial_status",
          previousValue: "active",
          newValue: "converted",
        },
      ],
      context,
      financialImpact: conversionDetails.amount && conversionDetails.currency
        ? {
            amount: conversionDetails.amount,
            currency: conversionDetails.currency,
            transactionType: BillingTransactionType.CHARGE,
          }
        : undefined,
      metadata: {
        trialEndDate: conversionDetails.trialEndDate,
        seats: conversionDetails.seats || 1,
        planName,
        convertedAmount: conversionDetails.amount,
        convertedCurrency: conversionDetails.currency,
        ...metadata,
      },
    });

    // Record transaction if payment amount is provided
    if (conversionDetails.amount && conversionDetails.currency) {
      await this.recordTransaction({
        entityType: BillingEntityType.HUB,
        entityId,
        transactionType: BillingTransactionType.CHARGE,
        amount: conversionDetails.amount,
        currency: conversionDetails.currency,
        description: `Trial converted to paid subscription`,
        eventId,
        subscriptionId: metadata?.subscriptionId,
      });
    }

    return eventId;
  }

  /**
   * Record a hub creation event - start of billing eligibility
   */
  async recordHubCreated(
    entityId: string,
    hubName: string,
    initialPlan: string,
    context: BillingEventDto["context"],
    hubDetails?: {
      hubUrl?: string;
      description?: string;
      planLimits?: Record<string, any>;
    },
  ): Promise<string> {
    const changes = [
      {
        field: "hub_name",
        previousValue: null as any,
        newValue: hubName,
      },
      {
        field: "initial_plan",
        previousValue: null as any,
        newValue: initialPlan,
      },
      {
        field: "billing_eligibility",
        previousValue: false,
        newValue: true,
      },
    ];

    return await this.recordBillingEvent({
      eventType: BillingEventType.HUB_CREATED,
      entityType: BillingEntityType.HUB,
      entityId,
      changes,
      context,
      metadata: {
        hubName,
        initialPlan,
        hubUrl: hubDetails?.hubUrl,
        description: hubDetails?.description,
        createdAt: new Date(),
      },
    });
  }

  /**
   * Helper method to extract plan limit differences for audit logging
   */
  private extractPlanLimitChanges(
    previousPlanLimits: Record<string, any> = {},
    newPlanLimits: Record<string, any> = {},
  ): Array<{ field: string; previousValue: any; newValue: any }> {
    const changes: Array<{ field: string; previousValue: any; newValue: any }> =
      [];

    // Get all unique limit keys from both plans
    const allLimitKeys = new Set([
      ...Object.keys(previousPlanLimits),
      ...Object.keys(newPlanLimits),
    ]);

    for (const limitKey of allLimitKeys) {
      const previousLimit = previousPlanLimits[limitKey];
      const newLimit = newPlanLimits[limitKey];

      // Check if the limit has changed
      if (JSON.stringify(previousLimit) !== JSON.stringify(newLimit)) {
        changes.push({
          field: `limit_${limitKey}`,
          previousValue: previousLimit || null,
          newValue: newLimit || null,
        });
      }
    }

    return changes;
  }

  /**
   * Record a license change event (seats reserved, freed, or optimized)
   */
  async recordLicenseChange(
    entityId: string,
    eventType:
      | BillingEventType.SEAT_RESERVED_BY_USER_ADDITION
      | BillingEventType.SEAT_RELEASED_BY_USER_REMOVAL
      | BillingEventType.SEATS_CLEANED_UP_AS_UNUSED,
    previousLicense: any,
    newLicense: any,
    context: {
      actor: { type: BillingActorType; name: string };
      source: BillingSource;
      externalId?: string;
      reason?: string;
    },
    metadata?: Record<string, any>,
  ): Promise<string> {
    // Calculate license changes
    const changes = this.calculateLicenseChanges(previousLicense, newLicense);

    if (changes.length === 0) {
      console.warn("No license changes detected, skipping audit log");
      return "";
    }

    return await this.recordBillingEvent({
      eventType,
      entityType: BillingEntityType.HUB,
      entityId,
      changes,
      context,
      metadata,
    });
  }

  /**
   * Calculate changes between license states
   */
  private calculateLicenseChanges(
    previousLicense: any,
    newLicense: any,
  ): Array<{ field: string; previousValue: any; newValue: any }> {
    const changes: Array<{
      field: string;
      previousValue: any;
      newValue: any;
    }> = [];

    const licenseFields = ["totalSeats", "usedSeats", "availableSeats"];

    for (const field of licenseFields) {
      const previousValue = previousLicense?.[field];
      const newValue = newLicense?.[field];

      if (previousValue !== newValue) {
        changes.push({
          field,
          previousValue: previousValue || null,
          newValue: newValue || null,
        });
      }
    }

    return changes;
  }
}
