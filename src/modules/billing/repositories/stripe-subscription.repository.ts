import { Injectable, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { SubscriptionStatus } from "@src/modules/common/enum/billing.enum";
import { Db, ObjectId, UpdateResult } from "mongodb";
import { TeamsPlan } from "@src/modules/common/models/team.model";

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
      billing?: any;
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
   * Updates all workspaces associated with a team to have the same plan
   * @param teamId The team/hub ID
   * @param planData The plan data to update (id and name)
   * @returns The update result
   */
  // async updateWorkspacePlans(
  //   teamId: string,
  //   planData: {
  //     id: ObjectId;
  //     name: string;
  //   },
  // ): Promise<UpdateResult> {
  //   try {
  //     return await this.db.collection(Collections.WORKSPACE).updateMany(
  //       { "team.id": teamId },
  //       {
  //         $set: {
  //           "plan.id": planData.id,
  //           "plan.name": planData.name,
  //         },
  //       },
  //     );
  //   } catch (error) {
  //     throw error;
  //   }
  // }

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
          "billing.requires_action_at_period_end": true,
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
          "billing.billingType": "trial",
          "billing.current_period_end": { $lt: currentDate },
        })
        .toArray();
    } catch (error) {
      throw error;
    }
  }
}
