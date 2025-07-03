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
