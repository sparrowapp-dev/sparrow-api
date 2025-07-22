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
   * Find teams with subscriptions ending in 3 days (for license optimization)
   * @param targetDate The date to check (should be 3 days from current date)
   * @returns Array of team documents with subscriptions ending in 3 days
   */
  async findTeamsWithSubscriptionsEndingIn3Days(
    targetDate: Date,
  ): Promise<any[]> {
    try {
      // Create date range for 3 days from now (targetDate to targetDate + 1 day)
      const startOfTargetDate = new Date(targetDate);
      startOfTargetDate.setHours(0, 0, 0, 0);

      const endOfTargetDate = new Date(targetDate);
      endOfTargetDate.setHours(23, 59, 59, 999);

      return await this.db
        .collection(Collections.TEAM)
        .find({
          $and: [
            {
              "billing.current_period_end": {
                $gte: startOfTargetDate,
                $lte: endOfTargetDate,
              },
            },
            {
              "billing.status": SubscriptionStatus.ACTIVE,
            },
            {
              "plan.name": { $ne: PlanName.COMMUNITY },
            },
            {
              // Only process teams with Stripe subscriptions
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
      throw error;
    }
  }
}
