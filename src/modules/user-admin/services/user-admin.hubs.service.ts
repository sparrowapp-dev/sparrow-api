import { Injectable, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { AdminWorkspaceRepository } from "../repositories/user-admin.workspace.repository";

interface SortOptions {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

@Injectable()
export class AdminHubsService {
  constructor(
    private readonly teamsRepo: AdminHubsRepository,
    private readonly workspaceRepo: AdminWorkspaceRepository,
  ) {}

  async getHubsForUser(userId: string) {
    const userObjectId = new ObjectId(userId);
    const teams = await this.teamsRepo.findBasicTeamsByUserId(userId);

    if (!teams.length) {
      throw new NotFoundException("No teams found for this user");
    }

    return teams.map((team) => {
      const matchedUser = team.users.find(
        (u: any) => u.id?.toString() === userObjectId.toString(),
      );

      return {
        teamId: team._id,
        teamName: team.name,
        role: matchedUser?.role,
        users: team.users,
        workspaces: team.workspaces,
      };
    });
  }

  async getAllHubsSummaryForUser(userId: string) {
    const teams = await this.teamsRepo.findTeamsByUserId(userId);

    if (!teams.data.length) {
      throw new NotFoundException("No teams found for this user");
    }

    const hubsSummary = await this.buildHubSummary(teams.data);
    return hubsSummary;
  }

  private async buildHubSummary(hubs: any[]) {
    // Map to store highest role for each unique user
    const userHighestRoleMap = new Map<string, "admin" | "member">();
    let totalWorkspaces = 0;
    let privateWorkspaces = 0;
    let publicWorkspaces = 0;

    // First pass: determine each user's highest role globally
    for (const hub of hubs) {
      for (const user of hub.users) {
        const userId = user.id.toString();
        const role =
          user.role === "owner" || user.role === "admin" ? "admin" : "member";

        if (!userHighestRoleMap.has(userId)) {
          userHighestRoleMap.set(userId, role);
        } else if (
          userHighestRoleMap.get(userId) === "member" &&
          role === "admin"
        ) {
          userHighestRoleMap.set(userId, "admin");
        }
      }
    }

    // Count workspaces
    for (const hub of hubs) {
      totalWorkspaces += hub.workspaces.length;

      for (const workspace of hub.workspaces) {
        try {
          const workspaceInfo = await this.workspaceRepo.findWorkspaceById(
            workspace.id?.toString(),
          );

          if (workspaceInfo) {
            if (workspaceInfo.workspaceType === "PRIVATE") {
              privateWorkspaces++;
            } else {
              publicWorkspaces++;
            }
          }
        } catch (error) {
          console.error(
            `Failed to fetch workspace ${workspace.id}: ${error.message}`,
          );
        }
      }
    }

    // Count unique admins and members based on their highest role
    let adminCount = 0;
    let memberCount = 0;

    userHighestRoleMap.forEach((role) => {
      if (role === "admin") {
        adminCount++;
      } else {
        memberCount++;
      }
    });

    return {
      totalHubs: hubs.length,
      workspaces: {
        total: totalWorkspaces,
        private: privateWorkspaces,
        public: publicWorkspaces,
      },
      totalContributors: {
        admins: adminCount,
        members: memberCount,
        total: adminCount + memberCount,
      },
    };
  }

  async getAllHubsForUser(
    userId: string,
    page: number,
    limit: number,
    search: string,
    sortOptions: SortOptions,
  ) {
    try {
      const skip = (page - 1) * limit;
      const teams = await this.teamsRepo.findTeamsByUserId(
        userId,
        skip,
        limit,
        search,
        sortOptions.sortBy,
        sortOptions.sortOrder,
      );
      if (!teams?.data?.length) {
        return {
          totalpages: 0,
          currentPage: page,
          totalCount: 0,
          limit: limit,
          hubs: [],
          sortBy: sortOptions?.sortBy,
          sortOrder: sortOptions?.sortOrder,
        };
      }

      const userTeams = await Promise.all(
        teams.data.map(async (team) => {
          const workspaceStats = {
            total: team.workspaces?.length || 0,
            private: 0,
            public: 0,
          };

          const workspaces = await Promise.all(
            (team.workspaces || []).map(async (workspace: any) => {
              try {
                const workspaceInfo =
                  await this.workspaceRepo.findWorkspaceById(
                    workspace.id?.toString(),
                  );

                if (workspaceInfo) {
                  workspaceStats[
                    workspaceInfo.workspaceType === "PRIVATE"
                      ? "private"
                      : "public"
                  ]++;

                  return {
                    id: workspaceInfo._id,
                    name: workspaceInfo.name,
                    type: workspaceInfo.workspaceType,
                    description: workspaceInfo.description,
                    createdAt: workspaceInfo.createdAt,
                    updatedAt: workspaceInfo.updatedAt,
                  };
                }
              } catch (error) {
                console.error(
                  `Failed to fetch workspace ${workspace.id}: ${error.message}`,
                );
              }
              return null;
            }),
          );

          return {
            _id: team._id,
            hubUrl: team?.hubUrl,
            name: team?.name,
            workspaceStats,
            workspaces: workspaces.filter(Boolean),
            contributors: {
              total: team?.users?.length || 0,
              details: team?.users?.map((user: any) => ({
                id: user.id,
                role: user.role,
                email: user.email,
              })),
            },
            createdAt: team?.createdAt,
            updatedAt: team?.updatedAt,
          };
        }),
      );

      return {
        totalpages: teams.pagination.totalPages,
        currentPage: teams.pagination.currentPage,
        totalCount: teams.pagination.total,
        limit: teams.pagination.limit,
        hubs: userTeams,
        sortBy: sortOptions.sortBy,
        sortOrder: sortOptions.sortOrder,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to fetch hubs: ${error.message}`);
    }
  }
}
