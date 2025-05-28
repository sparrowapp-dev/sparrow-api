import { Injectable } from "@nestjs/common";
import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { AdminWorkspaceRepository } from "../repositories/user-admin.workspace.repository";
import { TeamRepository } from "@src/modules/identity/repositories/team.repository";

@Injectable()
export class AdminBillingService {
  constructor(
    private readonly adminHubsRepo: AdminHubsRepository,
    private readonly adminWorkspaceRepo: AdminWorkspaceRepository,
    private readonly teamRepository: TeamRepository,
  ) {}

  async saveBillingAddressDetails(data: any, teamsId: string) {
    const teamData = await this.adminHubsRepo.saveTeamBillingAddressInfo(
      teamsId,
      data,
    );

    return teamData;
  }
}
