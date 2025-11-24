import { Injectable } from "@nestjs/common";
import { StripeSubscriptionRepository } from "../repositories/stripe-subscription.repository";
import { DownGradeTeamRepository } from "../repositories/downgradeTeam.repository";
import { ObjectId } from "mongodb";
import { DownGradeWorkspaceRepository } from "../repositories/downgradeWorkspace.repository";

@Injectable()
export class UpGradeService {
  constructor(
    private readonly stripeSubscriptionRepository: StripeSubscriptionRepository,
    private readonly downgradeTeamRepository: DownGradeTeamRepository,
    private readonly downgradeworkspaceRepository: DownGradeWorkspaceRepository,
  ) {}

  /**
   * Add upgrade details for a specific team.
   * @param teamId - The unique identifier of the team being upgraded.
   * @param workspaces - An array of workspace objects (each containing `id` and `name`)
   *                     associated with the downgrade.
   * associated workspaces.
   */
  async addUpgradeDetails(
    teamId: string,
    workspaces: Array<{ id: string; name: string }>,
  ) {
    try {
      await this.stripeSubscriptionRepository.addUpgradeDetails(
        teamId,
        workspaces,
      );
    } catch (error) {
      console.log("Error in add Upgrade", error);
    }
  }

  /**
   * Remove existing upgrade details for a team.
   *
   * @param teamId - The unique identifier of the team whose upgrade details are to be removed.
   */
  async removeDowngradeDetails(teamId: string) {
    try {
      await this.stripeSubscriptionRepository.removeUpgradeDetails(teamId);
    } catch (error) {
      console.log("Error in Remove Upgrade", error);
    }
  }

  /**
   * Checks whether a team's restricted workspaces can be restored based on the
   * workspace limits defined in the selected plan.
   *
   * @param {string} teamId - The ID of the team whose workspaces are being checked.
   * @param {string} selectedPlan - The name of the plan the team is attempting to upgrade to.
   * @returns {Promise<Array>} - A list of restricted workspaces that require attention,
   *                             or an empty array if no restrictions apply.
   */
  async getWorkspacesRestortable(
    teamId: string,
    selectedPlan: string,
  ): Promise<Array<any>> {
    const teamObject = new ObjectId(teamId);
    const team =
      await this.downgradeTeamRepository.findTeamByTeamId(teamObject);
    if (!team || !team.workspaces) {
      return [];
    }
    const restrictedWorkspaces = team.workspaces.filter(
      (ws) => ws.isRestricted === true,
    );
    const plan =
      await this.stripeSubscriptionRepository.findPlanByName(selectedPlan);
    if (!plan || !plan?.limits?.workspacesPerHub) {
      return [];
    }
    const maxWorkspaces = plan.limits.workspacesPerHub.value;
    if (team.workspaces.length > maxWorkspaces) {
      const workspaceIds = restrictedWorkspaces.map((w) => w.id.toString());
      const getWorkspaces =
        await this.downgradeworkspaceRepository.getWorkspacesByIds(
          workspaceIds,
        );

      let restrictedWorkspacesDetails: any[] = [];

      for (let restrictedWs of restrictedWorkspaces) {
        // Find the corresponding workspace details
        const workspaceDetail = getWorkspaces.find(
          (ws) => ws._id.toString() === restrictedWs.id.toString(),
        );

        if (workspaceDetail) {
          restrictedWorkspacesDetails.push({
            ...restrictedWs,
            collection: workspaceDetail?.collection?.length || 0,
            contributors: workspaceDetail?.users?.length || 0,
            lastUpdated: workspaceDetail?.updatedAt || null,
          });
        } else {
          // If workspace details not found, add with default values
          restrictedWorkspacesDetails.push({
            ...restrictedWs,
            collection: 0,
            contributors: 0,
            lastUpdated: null,
          });
        }
      }

      return restrictedWorkspacesDetails;
    }
    return [];
  }
}
