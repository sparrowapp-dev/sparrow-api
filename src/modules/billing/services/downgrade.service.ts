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
import { WorkspaceDtoWithRestriction } from "@src/modules/common/models/workspace.model";
import { PlanName } from "@src/modules/common/enum/plan.enum";

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
    const teamUsersData = teamData.users;
    const teamAdminsData = teamData.admins;
    const updateTeamUsersData = teamUsersData.filter(
      (user) => !payload.userIds.includes(user.id),
    );
    const updateAdminUserData = teamAdminsData.filter(
      (admin) => !payload.userIds.includes(admin),
    );
    const workspaces = teamData.workspaces;
    for (let workspace of workspaces) {
      const workspaceData = await this.downgradeWorkspaceReposiory.get(
        workspace.id.toString(),
      );
      const updatedUsers = workspaceData.users.filter(
        (user) => !payload.userIds.includes(user.id),
      );
      const updatedAdmins = workspaceData.admins.filter(
        (admin) => !payload.userIds.includes(admin.id),
      );
      await this.downgradeWorkspaceReposiory.updateWorkspaceUsers(
        workspace.id.toString(),
        updatedUsers,
        updatedAdmins,
      );
    }
    for (let user of payload.userIds) {
      const userObject = new ObjectId(user);
      const userData =
        await this.downgradeUserRepository.findUserByUserId(userObject);
      const updateUserTeams = userData.teams.filter(
        (usr) => usr.id.toString() != payload.teamId,
      );
      const updateUserWorkspaces = userData.workspaces.filter(
        (workspace) =>
          !workspaces.some((w) => w.id.toString() === workspace.workspaceId),
      );
      await this.downgradeUserRepository.updateUserTeamsAndWorkspaces(
        userObject,
        updateUserTeams,
        updateUserWorkspaces,
      );
    }
    const teamUpdatedParams = {
      users: updateTeamUsersData,
      admins: updateAdminUserData,
    };
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

  async restrictTeamWorkspace(teamId: string, workspaceIds: string[]) {
    const teamObject = new ObjectId(teamId);
    const teamData =
      await this.downgradeTeamRepository.findTeamByTeamId(teamObject);
    const updatedWorkspaces = teamData.workspaces.map((workspace) => {
      const workspaceId = workspace.id.toString();
      if (workspaceIds.includes(workspaceId)) {
        return {
          ...workspace,
          isRestricted: true,
        };
      }
      return workspace;
    });
    const teamUpdated = {
      workspaces: updatedWorkspaces,
    };
    const data = await this.downgradeTeamRepository.updateTeamById(
      teamObject,
      teamUpdated,
    );
    return data;
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
  async unRestrictWorkspaces(team: Team, teamId: string) {
    try {
      const teamObject = new ObjectId(teamId);
      const restrictedWorkspaces = team.workspaces.filter(
        (workspace) => workspace.isRestricted === true,
      );
      if (restrictedWorkspaces.length > 0) {
        let workspacesToUnrestrict: WorkspaceDtoWithRestriction[] = [];
        let updatedWorkspaces: WorkspaceDtoWithRestriction[];
        if (team.workspaces.length > team.plan.limits.workspacesPerHub.value) {
          const unRestrictedWorkspaceCount =
            team.workspaces.length - restrictedWorkspaces.length;
          // Calculate how many MORE workspaces can be unrestricted
          const canUnrestrictCount =
            team.plan.limits.workspacesPerHub.value -
            unRestrictedWorkspaceCount;

          // Take only the number of workspaces that can be unrestricted
          workspacesToUnrestrict = restrictedWorkspaces.slice(
            0,
            canUnrestrictCount > 0 ? canUnrestrictCount : 0,
          );

          // Get IDs of workspaces that will be unrestricted
          const workspacesToUnrestrictIds = new Set(
            workspacesToUnrestrict.map((w) => w.id.toString()),
          );

          // Update workspaces: set isRestricted to false only for workspaces in workspacesToUnrestrict
          updatedWorkspaces = team.workspaces.map((workspace) => {
            if (
              workspace.isRestricted &&
              workspacesToUnrestrictIds.has(workspace.id.toString())
            ) {
              return {
                ...workspace,
                isRestricted: false,
              };
            }
            return workspace;
          });
        } else {
          // Team has EQUAL or LESS workspaces than allowed - unrestrict ALL
          workspacesToUnrestrict = restrictedWorkspaces;

          // Set all workspaces to isRestricted: false
          updatedWorkspaces = team.workspaces.map((workspace) => {
            if (workspace.isRestricted) {
            }
            return {
              ...workspace,
              isRestricted: false,
            };
          });
        }
        // Unrestrict the workspaces in the database
        for (const workspace of workspacesToUnrestrict) {
          await this.downgradeWorkspaceReposiory.setWorkspaceRestriction(
            workspace.id.toString(),
            false,
          );
        }
        const teamUpdated = {
          workspaces: updatedWorkspaces,
        };
        await this.downgradeTeamRepository.updateTeamById(
          teamObject,
          teamUpdated,
        );
      }
    } catch (error) {
      console.error("Error in Removing restricted Workspaces.", error);
    }
  }

  async enableAutoDowngrade(
    teamId: string,
    workspaces: WorkspaceDtoWithRestriction[],
  ) {
    try {
      await this.stripeSubscriptionRepository.enableAutoDowngrade(teamId);
      const workspaceIds = workspaces.map((workspace) =>
        workspace.id.toString(),
      );
      await this.downgradeWorkspaceReposiory.setMultipleWorkspaceRestrictions(
        workspaceIds,
        true,
      );
    } catch (error) {
      console.log(error);
    }
  }

  async disableAutoDowngrade(
    teamId: string,
    workspaces: WorkspaceDtoWithRestriction[],
  ) {
    try {
      await this.stripeSubscriptionRepository.disableAutoDowngrade(teamId);
      // All workspaces are within the limit, disable restrictions for all
      const workspaceIds = workspaces.map((workspace) =>
        workspace.id.toString(),
      );
      await this.downgradeWorkspaceReposiory.setMultipleWorkspaceRestrictions(
        workspaceIds,
        false,
      );
    } catch (error) {
      console.log(error);
    }
  }

  async validateWorkspaceRestrictions(
    teamDetails: Team,
    teamID: string,
    newPlan: PlanName,
  ): Promise<void> {
    try {
      const planData =
        await this.stripeSubscriptionRepository.findPlanByName(newPlan);
      if (!teamDetails || !Array.isArray(teamDetails.workspaces)) {
        return;
      }
      // Get only unrestricted workspaces
      // A workspace is unrestricted if isRestricted is not present OR isRestricted === false
      const unrestrictedWorkspaces = teamDetails.workspaces.filter(
        (w) => w?.isRestricted !== true,
      );
      const unRestrictedCount = unrestrictedWorkspaces.length;
      const limit = planData?.limits?.workspacesPerHub?.value ?? 0;
      // Only act when unrestricted workspaces exceed the plan limit
      if (unRestrictedCount > limit) {
        // Get excess workspaces (those beyond the limit)
        const idsToRestrict = unrestrictedWorkspaces
          .slice(limit) // Take all workspaces after the limit
          .map((w) => w.id.toString());
        await this.restrictTeamWorkspace(teamID, idsToRestrict);
        for (const wid of idsToRestrict) {
          await this.restrictWorkspace(wid);
        }
      }
    } catch (error) {
      console.log("Error in validateWorkspaceRestrictions:", error);
    }
  }
}
