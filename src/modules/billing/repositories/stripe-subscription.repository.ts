import { Injectable, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import {
  BillingType,
  PaymentProvider,
  SubscriptionStatus,
} from "@src/modules/common/enum/billing.enum";
import { Db, ObjectId, UpdateResult } from "mongodb";
import { TeamsPlan } from "@src/modules/common/models/team.model";
import { PlanName } from "@src/modules/common/enum/plan.enum";
import { BillingDto } from "@src/modules/common/models/billing.model";

/**
 * Repository for managing Stripe subscription data in the database
 */
@Injectable()
export class StripeSubscriptionRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Updates a team's plan based on subscription data
   * @param hubId The team/hub ID
   * @param planData The plan data to update (id and name only)
   * @param subscriptionData Additional subscription data
   * @returns The update result
   */
  async updateTeamPlan(
    hubId: string,
    planData: TeamsPlan,
    subscriptionData: {
      billing?: BillingDto;
    },
  ): Promise<UpdateResult> {
    try {
      const teamId = new ObjectId(hubId);

      const updateDoc: any = {
        $set: {
          plan: planData,
        },
      };

      // Add billing info if provided
      if (subscriptionData.billing) {
        // Move subscription details into billing object
        updateDoc.$set.billing = subscriptionData.billing;
      }

      return await this.db
        .collection(Collections.TEAM)
        .updateOne({ _id: teamId }, updateDoc);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update team with arbitrary data
   * @param teamId The team ID
   * @param updateData The data to update
   * @returns The update result
   */
  async updateTeamById(teamId: string, updateData: any): Promise<UpdateResult> {
    try {
      return await this.db
        .collection(Collections.TEAM)
        .updateOne({ _id: new ObjectId(teamId) }, { $set: updateData });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a plan by name
   * @param planName The name of the plan to find
   * @returns The plan document or null if not found
   */
  async findPlanByName(planName: string): Promise<any> {
    try {
      return await this.db
        .collection(Collections.PLAN)
        .findOne({ name: planName });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a team by ID
   * @param teamId The team ID
   * @returns The team document or null if not found
   */
  async findTeamById(teamId: string): Promise<any> {
    try {
      return await this.db
        .collection(Collections.TEAM)
        .findOne({ _id: new ObjectId(teamId) });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a team by Stripe customer ID
   * @param customerId The Stripe customer ID
   * @returns The team document or null if not found
   */
  async findTeamByCustomerId(customerId: string): Promise<any> {
    try {
      return await this.db
        .collection(Collections.TEAM)
        .findOne({ 
          $or: [
            { "billing.customerId": customerId },
            { "billing.paymentProviders.customerId": customerId }
          ]
        });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find teams with failed payment subscriptions that have expired billing cycles
   * @param currentDate The current date to compare against billing cycle end dates
   * @returns Array of team documents with expired failed subscriptions
   */
  async findTeamsWithExpiredFailedSubscriptions(
    currentDate: Date,
  ): Promise<any[]> {
    try {
      return await this.db
        .collection(Collections.TEAM)
        .find({
          "billing.status": SubscriptionStatus.PAYMENT_FAILED,
          "billing.current_period_end": { $lt: currentDate },
        })
        .toArray();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find teams with expired trials that need to be reverted to community plan
   * @param currentDate The current date to compare against trial end dates
   * @returns Array of team documents with expired trials
   */
  async findTeamsWithExpiredTrials(currentDate: Date): Promise<any[]> {
    try {
      return await this.db
        .collection(Collections.TEAM)
        .find({
          "billing.billingType": BillingType.TRIAL,
          "billing.current_period_end": { $lt: currentDate },
        })
        .toArray();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find teams with either:
   * 1. Failed payment subscriptions that have expired billing cycles, or
   * 2. Expired trial periods,
   * and that haven't already been processed today (no expired email sent today).
   *
   * @param currentDate The current date to compare against billing end dates
   * @returns Array of team documents with expired billing needing action
   */
  async findTeamsWithExpiredBilling(currentDate: Date): Promise<any[]> {
    try {
      return await this.db
        .collection(Collections.TEAM)
        .find({
          $and: [
            {
              $or: [
                {
                  "billing.status": SubscriptionStatus.PAYMENT_FAILED,
                  "billing.current_period_end": { $lt: currentDate },
                },
                {
                  "billing.billingType": BillingType.TRIAL,
                  "billing.current_period_end": { $lt: currentDate },
                },
              ],
            },
            {
              $or: [
                {
                  "billing.subscription_expired_email_sent": { $exists: false },
                },
              ],
            },
            {
              "plan.name": { $ne: PlanName.COMMUNITY },
            },
          ],
        })
        .toArray();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find teams with subscriptions ending in the given time window
   * @param start Start datetime (e.g., now)
   * @param end End datetime (e.g., now + 12 hours)
   * @returns Array of team documents with subscriptions ending in range
   */
  async findTeamsWithSubscriptionsEndingInRange(
    start: Date,
    end: Date,
  ): Promise<any[]> {
    try {
      return await this.db
        .collection(Collections.TEAM)
        .find({
          $and: [
            {
              "billing.current_period_end": {
                $gte: start,
                $lte: end,
              },
            },
            {
              "billing.status": SubscriptionStatus.ACTIVE,
            },
            {
              "plan.name": { $ne: PlanName.COMMUNITY },
            },
            {
              "billing.paymentProviders": {
                $elemMatch: {
                  provider: PaymentProvider.STRIPE,
                  subscriptionId: { $exists: true, $ne: null },
                },
              },
            },
          ],
        })
        .toArray();
    } catch (error) {
      console.error("Error fetching teams with expiring subscriptions:", error);
      throw error;
    }
  }
}
