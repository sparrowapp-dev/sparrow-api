import { Injectable } from "@nestjs/common";
import { TeamRole } from "@src/modules/common/enum/roles.enum";
import { Team } from "@src/modules/common/models/team.model";
import { DeleteResult, ObjectId, WithId } from "mongodb";
import { DowngradeUserDto } from "../payloads/downgrade-user.payload";
import { DownGradeTeamRepository } from "../repositories/downgradeTeam.reposiotry";
import { DownGradeUserRepository } from "../repositories/downgradeUser.repository";
import { LicenseManagementService } from "./license-management.service";
import { DownGradeWorkspaceRepository } from "../repositories/downgradeWorkspace.repository";
import { isString } from "class-validator";

@Injectable()
export class DownGradeService {
  constructor(
    private readonly downgradeTeamRepository: DownGradeTeamRepository,
    private readonly downgradeUserRepository: DownGradeUserRepository,
    private readonly licenseManagementService: LicenseManagementService,
    private readonly downgradeWorkspaceReposiory: DownGradeWorkspaceRepository,
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

  async deleteWorkspace(id: string): Promise<DeleteResult> {
    const workspace = await this.downgradeWorkspaceReposiory.get(id);
    const teamData = await this.downgradeTeamRepository.findTeamByTeamId(
      new ObjectId(workspace.team.id),
    );
    const teamWorkspaces = [...teamData.workspaces];
    const updatedTeamWorkspaces = teamWorkspaces.filter(
      (workspace) => workspace.id.toString() !== id,
    );
    const updatedTeamParams = {
      workspaces: updatedTeamWorkspaces,
    };
    await this.downgradeTeamRepository.updateTeamById(
      new ObjectId(workspace.team.id),
      updatedTeamParams,
    );
    const workspaceUsers = [...workspace.users];
    const updatedIdArray = [];
    for (const item of workspaceUsers) {
      if (!isString(item.id)) {
        updatedIdArray.push(item.id);
        continue;
      }
      updatedIdArray.push(new ObjectId(item.id));
    }
    const userDataArray =
      await this.downgradeUserRepository.findUsersByIdArray(updatedIdArray);
    for (let index = 0; index < userDataArray.length; index++) {
      userDataArray[index].workspaces = userDataArray[index].workspaces.filter(
        (item: any) => item.workspaceId.toString() !== id,
      );
    }
    const userDataPromises = [];
    for (const item of userDataArray) {
      userDataPromises.push(
        this.downgradeUserRepository.updateUserById(
          new ObjectId(item._id),
          item,
        ),
      );
    }
    await Promise.all(userDataPromises);
    const data = await this.downgradeWorkspaceReposiory.delete(id);
    return data;
  }
}
