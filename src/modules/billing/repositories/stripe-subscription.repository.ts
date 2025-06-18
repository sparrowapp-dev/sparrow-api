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
      return await this.db
        .collection(Collections.WORKSPACE)
        .updateMany(
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
}
