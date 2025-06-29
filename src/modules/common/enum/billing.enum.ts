/**
 * Enum for payment providers
 */
export enum PaymentProvider {
  STRIPE = "stripe",
  EXTERNAL_SOURCE = "external_source",
}

/**
 * Enum for billing types/variants
 */
export enum BillingType {
  TRIAL = "trial",
  EXPIRED_TRIAL = "expired_trial",
  COMPLIMENTARY = "complimentary",
  PAID = "paid",
  DISCOUNTED = "discounted",
  INTERNAL = "internal",
}

/**
 * Enum for subscription statuses
 */
export enum SubscriptionStatus {
  ACTIVE = "active",
  CANCELED = "canceled",
  INCOMPLETE = "incomplete",
  INCOMPLETE_EXPIRED = "incomplete_expired",
  PAST_DUE = "past_due",
  TRIALING = "trialing",
  UNPAID = "unpaid",
  PENDING = "pending",
  PAYMENT_FAILED = "payment_failed",
  DELETED = "deleted",
  VOIDED = "voided",
}

/**
 * Enum for billing actor types - who initiated the action
 */
export enum BillingActorType {
  USER = "user",
  SYSTEM = "system",
  WEBHOOK = "webhook",
  API = "api",
  ADMIN = "admin",
}

/**
 * Enum for billing event sources - where the action originated
 */
export enum BillingSource {
  STRIPE_WEBHOOK = "stripe-webhook",
  BILLING_MAINTENANCE = "billing-maintenance",
  ADMIN_PANEL = "admin-panel",
  API_CALL = "api-call",
  USER_ACTION = "user-action",
  SCHEDULED_JOB = "scheduled-job",
  MIGRATION = "migration",
  MANUAL_ADJUSTMENT = "manual-adjustment",
}

/**
 * Enum for billing event types - represents specific business actions
 */
export enum BillingEventType {
  // Subscription lifecycle events
  SUBSCRIPTION_CREATED = "subscription_created",
  SUBSCRIPTION_RENEWED = "subscription_renewed",
  SUBSCRIPTION_UPGRADED = "subscription_upgraded",
  SUBSCRIPTION_CANCELED = "subscription_canceled",

  // Payment events
  PAYMENT_SUCCEEDED = "payment_succeeded",
  PAYMENT_FAILED = "payment_failed",

  // Trial events
  TRIAL_STARTED = "trial_started",
  TRIAL_EXTENDED = "trial_extended",
  TRIAL_EXPIRED = "trial_expired",
  TRIAL_CONVERTED = "trial_converted",

  // Plan changes
  PLAN_CHANGED = "plan_changed",
  SEATS_ADJUSTED = "seats_adjusted",

  // Billing adjustments
  CREDIT_APPLIED = "credit_applied",
  REFUND_ISSUED = "refund_issued",
  DISCOUNT_APPLIED = "discount_applied",
  DISCOUNT_REMOVED = "discount_removed",

  // Administrative actions
  BILLING_DETAILS_UPDATED = "billing_details_updated",
  INVOICE_GENERATED = "invoice_generated",
  INVOICE_VOIDED = "invoice_voided",

  // Enterprise specific
  CONTRACT_CREATED = "contract_created",
  CONTRACT_AMENDED = "contract_amended",
  BULK_SEAT_ADJUSTMENT = "bulk_seat_adjustment",
  CUSTOM_PRICING_APPLIED = "custom_pricing_applied",
}

/**
 * Enum for billing entity types - for enterprise hierarchies
 */
export enum BillingEntityType {
  ORGANIZATION = "organization",
  HUB = "hub",
  WORKSPACE = "workspace",
  USER = "user",
}

/**
 * Enum for billing transaction types
 */
export enum BillingTransactionType {
  CHARGE = "charge",
  REFUND = "refund",
  CREDIT = "credit",
  ADJUSTMENT = "adjustment",
  PRORATION = "proration",
}
