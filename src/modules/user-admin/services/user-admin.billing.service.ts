import { Injectable } from "@nestjs/common";
import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { AdminWorkspaceRepository } from "../repositories/user-admin.workspace.repository";
import { TeamRepository } from "@src/modules/identity/repositories/team.repository";
import { AdminAuthRepository } from "../repositories/user-admin.auth.repository";
import { ObjectId } from "mongodb";

@Injectable()
export class AdminBillingService {
  constructor(
    private readonly adminHubsRepo: AdminHubsRepository,
    private readonly adminWorkspaceRepo: AdminWorkspaceRepository,
    private readonly teamRepository: TeamRepository,
    private readonly adminAuthRepository: AdminAuthRepository,
  ) {}

  async saveBillingAddressDetails(data: any, teamsId: string) {
    const teamData = await this.teamRepository.findTeamByTeamId(
      new ObjectId(teamsId),
    );
    if (teamData.owner.toString() !== data.userId.toString()) {
      throw new Error(
        "You are not authorized to update billing address details for this team.",
      );
    }
    const updatedTeam = await this.adminHubsRepo.saveTeamBillingAddressInfo(
      teamsId,
      data,
    );

    return updatedTeam;
  }
}
