import { Injectable } from "@nestjs/common";
import { TeamRole } from "@src/modules/common/enum/roles.enum";
import { Team } from "@src/modules/common/models/team.model";
import { DeleteResult, ObjectId, WithId } from "mongodb";
import { DowngradeUserDto } from "../payloads/downgrade-user.payload";
import { DownGradeTeamRepository } from "../repositories/downgradeTeam.repository";
import { DownGradeUserRepository } from "../repositories/downgradeUser.repository";
import { LicenseManagementService } from "./license-management.service";
import { DownGradeWorkspaceRepository } from "../repositories/downgradeWorkspace.repository";
import { isString } from "class-validator";
import { SubscriptionDowngradeType } from "@src/modules/common/enum/billing.enum";
import { StripeSubscriptionRepository } from "../repositories/stripe-subscription.repository";

@Injectable()
export class DownGradeService {
  constructor(
    private readonly downgradeTeamRepository: DownGradeTeamRepository,
    private readonly downgradeUserRepository: DownGradeUserRepository,
    private readonly licenseManagementService: LicenseManagementService,
    private readonly downgradeWorkspaceReposiory: DownGradeWorkspaceRepository,
    private readonly stripeSubscriptionRepository: StripeSubscriptionRepository,
  ) {}

  async removeUserFromTeam(payload: DowngradeUserDto): Promise<WithId<Team>> {
    const teamFilter = new ObjectId(payload.teamId);
    const teamData =
      await this.downgradeTeamRepository.findTeamByTeamId(teamFilter);
    const userFilter = new ObjectId(payload.userId);
    const userData =
      await this.downgradeUserRepository.findUserByUserId(userFilter);
    const teamAdmins = [...teamData.admins];
    let userTeamRole;
    for (const item of userData.teams) {
      if (item.id.toString() === payload.teamId) {
        userTeamRole = item.role;
      }
    }
    const teamUser = [...teamData.users];
    let filteredAdmin;
    const filteredData = teamUser.filter(
      (item) => item.id.toString() !== payload.userId.toString(),
    );
    if (userTeamRole === TeamRole.ADMIN) {
      filteredAdmin = teamAdmins.filter(
        (id: string) => id.toString() !== payload.userId.toString(),
      );
    }
    const teamUpdatedParams = {
      users: filteredData,
      admins: userTeamRole === TeamRole.ADMIN ? filteredAdmin : teamAdmins,
    };
    const userTeams = [...userData.teams];
    const userFilteredTeams = userTeams.filter(
      (item) => item.id.toString() !== payload.teamId.toString(),
    );
    const userFilteredWorkspaces = userData.workspaces.filter(
      (workspace) => workspace.teamId !== payload.teamId,
    );
    const workspaces = teamData.workspaces;
    for (let workspace of workspaces) {
      const workspaceData = await this.downgradeWorkspaceReposiory.get(
        workspace.id.toString(),
      );
      const updatedUsers = workspaceData.users.filter(
        (user) => user.id !== payload.userId,
      );
      await this.downgradeWorkspaceReposiory.updateWorkspaceUsers(
        workspace.id.toString(),
        updatedUsers,
      );
    }
    const userUpdatedParams = {
      teams: userFilteredTeams,
      workspaces: userFilteredWorkspaces,
    };
    await this.downgradeUserRepository.updateUserById(
      userFilter,
      userUpdatedParams,
    );
    const data = await this.downgradeTeamRepository.updateTeamById(
      teamFilter,
      teamUpdatedParams,
    );
    // Update license tracking after user removal
    await this.licenseManagementService.updateLicenseTracking(payload.teamId);
    return data;
  }

  /**
   * Get owner details by ID.
   * @param {string} ownerId - The ID of the owner.
   * @param {any[]} users - Array of users.
   * @returns {Promise<{ email: string; name: string } | null>} Owner details or null if not found.
   */
  async getOwnerDetails(
    ownerId: string,
    users: any[],
  ): Promise<{ email: string; name: string } | null> {
    for (const user of users) {
      if (user.id.toString() === ownerId.toString()) {
        return { email: user.email, name: user.name };
      }
    }
    return null;
  }

  /**
   * Restrict a specific workspace by its ID.
   *
   * @param id - The unique identifier of the workspace to restrict.
   */
  async restrictWorkspace(id: string): Promise<any> {
    const response =
      await this.downgradeWorkspaceReposiory.setWorkspaceRestriction(id, true);
    return response;
  }

  /**
   * Add downgrade details for a specific team.
   * @param teamId - The unique identifier of the team being downgraded.
   * @param workspaces - An array of workspace objects (each containing `id` and `name`)
   *                     associated with the downgrade.
   * @param users - An array of user objects (each containing `id` and `email`)
   *                affected by the downgrade.
   * associated workspaces and users.
   */
  async addDowgradeDetails(
    teamId: string,
    workspaces: Array<{ id: string; name: string }>,
    users: Array<{ id: string; email: string }>,
  ) {
    try {
      await this.stripeSubscriptionRepository.addDowngradeDetails(
        teamId,
        workspaces,
        users,
        SubscriptionDowngradeType.MANUAL,
      );
    } catch (error) {
      console.log("Error in add Downgrade", error);
    }
  }

  /**
   * Remove existing downgrade details for a team.
   *
   * @param teamId - The unique identifier of the team whose downgrade details are to be removed.
   */
  async removeDowngradeDetails(teamId: string) {
    try {
      await this.stripeSubscriptionRepository.removeDowngradeDetails(teamId);
    } catch (error) {
      console.log("Error in Remove Downgrade", error);
    }
  }

  /**
   * unRestrict a specific Hub.
   * @param id - The unique identifier of the workspace to restrict.
   * @returns A promise resolving to the repository response after setting the restriction.
   **/
  async unRestrictWorkpsaces(team: Team) {
    try {
      const workspaces = team.workspaces;
      for (let workspace of workspaces) {
        await this.downgradeWorkspaceReposiory.setWorkspaceRestriction(
          workspace.id.toString(),
          false,
        );
      }
    } catch (error) {
      console.log("Error in Removing restricted Workspaces." + error);
    }
  }
}
