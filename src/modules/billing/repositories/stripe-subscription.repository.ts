import { Injectable, Inject, Logger } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db, ObjectId, UpdateResult } from "mongodb";

/**
 * Repository for managing Stripe subscription data in the database
 */
@Injectable()
export class StripeSubscriptionRepository {
  private readonly logger = new Logger(StripeSubscriptionRepository.name);

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
    planData: {
      id: ObjectId;
      name: string;
    },
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
      this.logger.error(
        `Error updating team plan: ${error.message}`,
        error.stack,
      );
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
      this.logger.error(
        `Error finding plan with name ${planName}: ${error.message}`,
        error.stack,
      );
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
      this.logger.error(
        `Error finding team with ID ${teamId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Updates all workspaces associated with a team to have the same plan
   * @param teamId The team/hub ID
   * @param planData The plan data to update (id and name)
   * @returns The update result
   */
  async updateWorkspacePlans(
    teamId: string,
    planData: {
      id: ObjectId;
      name: string;
    },
  ): Promise<UpdateResult> {
    try {
      return await this.db.collection(Collections.WORKSPACE).updateMany(
        { "team.id": teamId },
        {
          $set: {
            "plan.id": planData.id,
            "plan.name": planData.name,
          },
        },
      );
    } catch (error) {
      this.logger.error(
        `Error updating workspace plans for team ${teamId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get a subscription from Stripe by ID
   * @param subscriptionId The Stripe subscription ID
   * @returns The subscription object from Stripe or null if not found
   */
  async getSubscription(subscriptionId: string): Promise<any> {
    try {
      // First try to find the subscription in our database
      const team = await this.db.collection(Collections.TEAM).findOne({
        "billing.subscriptionId": subscriptionId,
      });

      if (team && team.billing) {
        return {
          id: team.billing.subscriptionId,
          customer: team.billing.stripeCustomerId,
          status: team.billing.status,
          current_period_start: team.billing.current_period_start,
          current_period_end: team.billing.current_period_end,
          metadata: {
            hubId: team._id.toString(),
            planName: team.plan.name,
          },
        };
      }

      // If not found in our database, log a warning
      this.logger.warn(`Subscription ${subscriptionId} not found in database`);

      // Return a minimal object with the ID to prevent null errors
      return { id: subscriptionId };
    } catch (error) {
      this.logger.error(
        `Error retrieving subscription ${subscriptionId}: ${error.message}`,
        error.stack,
      );
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
      // Find teams with payment_failed status where:
      // 1. They have the requires_action_at_period_end flag set to true
      // 2. The current_period_end date has passed
      return await this.db
        .collection(Collections.TEAM)
        .find({
          "billing.status": "payment_failed",
          "billing.requires_action_at_period_end": true,
          "billing.current_period_end": { $lt: currentDate },
        })
        .toArray();
    } catch (error) {
      this.logger.error(
        `Error finding teams with expired failed subscriptions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
