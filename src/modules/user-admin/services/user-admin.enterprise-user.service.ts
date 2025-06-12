import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { UserService } from "@src/modules/identity/services/user.service";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";
import { AdminUpdatesRepository } from "../repositories/user-admin.updates.repository";
import { ObjectId } from "mongodb";
import { AdminMembersRepository } from "../repositories/user-admin.members.repository";
import { TeamRole } from "@src/modules/common/enum/roles.enum";

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly teamsRepo: AdminHubsRepository,
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
    private readonly adminUpdatesRepository: AdminUpdatesRepository,
    private readonly adminUserRepository: AdminMembersRepository,
  ) {}

  async getAllUsers(userId: string) {
    const teams = await this.teamsRepo.findBasicTeamsByUserId(userId);

    if (!teams.length) {
      throw new NotFoundException("No teams found for this user");
    }
    const filteredTeams = teams.filter(
      (team) => team?.owner === userId.toString(),
    );
    const uniqueUserMap = new Map<
      string,
      {
        id: string;
        name: string;
        teams: any[];
      }
    >();

    for (const team of filteredTeams) {
      for (const user of team.users) {
        const userIdStr = user.id.toString(); // normalize ObjectId or string
        if (!uniqueUserMap.has(userIdStr)) {
          uniqueUserMap.set(userIdStr, {
            id: userIdStr,
            name: user.name,
            teams: [],
          });
        }
      }
    }

    const uniqueUsers = Array.from(uniqueUserMap.values());

    uniqueUsers.forEach((user) => {
      const userTeams = filteredTeams.filter((team) =>
        team.users.some(
          (teamUser: any) => teamUser.id.toString() === user.id.toString(),
        ),
      );

      // Assign the teams to the user
      user.teams = userTeams;
    });
    // const user = await this.userService.getUserById(userId);
    const newestUniqueUsers = await Promise.all(
      uniqueUsers.map(async (user: any) => {
        const userTeams = user.teams.map((team: any) => {
          const userRole = team.users.find(
            (member: any) => member.id.toString() === user.id.toString(),
          )?.role;

          return {
            id: team._id,
            name: team.name,
            role: userRole,
          };
        });

        const userOrg: any = await this.userService.getUserById(user.id);

        return {
          id: user.id,
          name: user.name,
          email: userOrg.email,
          teams: userTeams,
          teamsAccess: user.teams.length,
          lastActive: userOrg?.lastActive || "",
          joinedOrg: userOrg?.emailVerificationCodeTimeStamp,
        };
      }),
    );

    const updatedFilteredTeams = filteredTeams.map((team) => {
      return {
        name: team.name,
        id: team._id,
        users: team.users,
      };
    });
    return { teams: updatedFilteredTeams, users: newestUniqueUsers };
  }
  async getUserDetails(ownerId: string, userId: string) {
    // Fetch all required data in parallel
    const [teams, userOrg, memberWorkspaces] = await Promise.all([
      this.teamsRepo.findBasicTeamsByUserId(ownerId),
      this.userService.getUserById(userId),
      this.workspaceService.getAllWorkSpaces(userId),
    ]);

    // Validate teams exist
    if (!teams?.length) {
      throw new NotFoundException("No teams found for this user");
    }

    // Filter teams owned by the owner
    const ownerTeams = teams.filter(
      (team) => team?.owner?.toString() === ownerId.toString(),
    );

    // Filter teams where the user is a member
    const userTeams = ownerTeams.filter((team) =>
      team.users?.some(
        (user: any) => user.id?.toString() === userId.toString(),
      ),
    );

    // Build hub details
    const hubDetails = userTeams.map((team) => {
      // Find user in team
      const teamUser = team.users.find(
        (user: any) => user.id?.toString() === userId.toString(),
      );

      // Filter workspaces for this specific team
      const teamWorkspaces = memberWorkspaces.filter(
        (workspace) => workspace.team?.id?.toString() === team._id?.toString(),
      );

      // Build simplified workspaces with user roles
      const simplifiedWorkspaces = teamWorkspaces.map((workspace) => {
        const workspaceUser = workspace.users?.find(
          (user) => user.id?.toString() === userId.toString(),
        );

        return {
          workspace: workspace,
          userRole: workspaceUser?.role || null,
        };
      });

      return {
        id: teamUser.id,
        name: teamUser.name,
        email: teamUser.email,
        teamId: team._id,
        teamName: team.name,
        role: teamUser.role,
        teamJoiningData: teamUser.joinedAt,
        simplifiedWorkspaces: simplifiedWorkspaces,
      };
    });

    return {
      hubDetails: hubDetails,
      userDetails: {
        name: userOrg.name,
        email: userOrg.email,
      },
    };
  }

  async getDashboardStats(userId: string) {
    try {
      // Get current date and first day of current month
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get teams where user is owner or admin
      const teams = await this.teamsRepo.findTeamsByOwnerOrAdmin(
        userId.toString(),
      );

      if (!teams || teams.length === 0) {
        return {
          users: {
            total: 0,
            changeFromLastMonth: 0,
            admins: 0,
            members: 0,
          },
          hubs: { total: 0, changeFromLastMonth: 0 },
          invites: { total: 0, changeFromLastMonth: 0 },
        };
      }

      // Count hubs
      const totalHubs = teams.length;
      const newHubs = teams.filter(
        (team) =>
          team.createdAt && new Date(team.createdAt) >= firstDayThisMonth,
      ).length;

      // Track unique users by their highest role - similar to graph functions
      const userHighestRoleMap = new Map<
        string,
        TeamRole.ADMIN | TeamRole.MEMBER
      >();
      const newUserHighestRoleMap = new Map<
        string,
        TeamRole.ADMIN | TeamRole.MEMBER
      >();
      let totalInvites = 0;
      let newInvites = 0;

      teams.forEach((team) => {
        // Process users
        (team.users || []).forEach((user: any) => {
          const userId = user.id.toString();
          const role =
            user.role === TeamRole.OWNER || user.role === TeamRole.ADMIN
              ? TeamRole.ADMIN
              : TeamRole.MEMBER;

          // Track user's highest role across all teams
          if (!userHighestRoleMap.has(userId)) {
            userHighestRoleMap.set(userId, role);
          } else if (
            userHighestRoleMap.get(userId) === TeamRole.MEMBER &&
            role === TeamRole.ADMIN
          ) {
            // Upgrade role to admin if previously marked as member
            userHighestRoleMap.set(userId, TeamRole.ADMIN);
          }

          // Check if this user is new this month - special handling for owners
          let isNewThisMonth = false;

          if (user.joinedAt && new Date(user.joinedAt) >= firstDayThisMonth) {
            // Regular users with joinedAt date
            isNewThisMonth = true;
          } else if (
            user.role === TeamRole.OWNER &&
            team.createdAt &&
            new Date(team.createdAt) >= firstDayThisMonth
          ) {
            // Team owners of newly created teams
            isNewThisMonth = true;
          }

          if (isNewThisMonth) {
            if (!newUserHighestRoleMap.has(userId)) {
              newUserHighestRoleMap.set(userId, role);
            } else if (
              newUserHighestRoleMap.get(userId) === TeamRole.MEMBER &&
              role === TeamRole.ADMIN
            ) {
              // Upgrade role to admin if previously marked as member
              newUserHighestRoleMap.set(userId, TeamRole.ADMIN);
            }
          }
        });

        // Count invites
        const invites = team.invites || [];
        totalInvites += invites.length;

        // Count new invites
        newInvites += invites.filter(
          (invite: any) =>
            invite.createdAt && new Date(invite.createdAt) >= firstDayThisMonth,
        ).length;
      });

      // Count users by role
      let adminCount = 0;
      let memberCount = 0;
      let newAdminCount = 0;
      let newMemberCount = 0;

      userHighestRoleMap.forEach((role) => {
        if (role === TeamRole.ADMIN) {
          adminCount++;
        } else {
          memberCount++;
        }
      });

      newUserHighestRoleMap.forEach((role) => {
        if (role === TeamRole.ADMIN) {
          newAdminCount++;
        } else {
          newMemberCount++;
        }
      });

      // Calculate totals (consistent with graph functions)
      const totalUsers = adminCount + memberCount;
      const newUsers = newAdminCount + newMemberCount;

      return {
        users: {
          total: totalUsers,
          changeFromLastMonth: newUsers,
          admins: adminCount,
          members: memberCount,
        },
        hubs: {
          total: totalHubs,
          changeFromLastMonth: newHubs,
        },
        invites: {
          total: totalInvites,
          changeFromLastMonth: newInvites,
        },
      };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw new InternalServerErrorException(
        "Failed to fetch dashboard statistics",
      );
    }
  }
  /**
   * Get activity records for all users in the admin's teams
   */

  async getUserActivities(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    activities: any[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      // Find all teams where the user is owner or admin
      const teams = await this.teamsRepo.findTeamsByOwnerOrAdmin(userId);

      if (!teams || teams.length === 0) {
        return {
          activities: [],
          totalCount: 0,
          currentPage: page,
          totalPages: 0,
          limit: limit,
        };
      }

      // Extract all team members' user IDs
      const teamUserIds = new Set<string>();
      teams.forEach((team) => {
        (team.users || []).forEach((user) => {
          if (user.id) {
            teamUserIds.add(user.id.toString());
          }
        });
      });

      // Extract all workspace IDs from these teams
      const workspaceIds = new Set<string>();
      teams.forEach((team) => {
        (team.workspaces || []).forEach((workspace) => {
          if (workspace.id) {
            workspaceIds.add(workspace.id.toString());
          }
        });
      });

      // Convert user IDs to ObjectIds for MongoDB query
      const userObjectIds = [];
      for (const id of teamUserIds) {
        try {
          userObjectIds.push(new ObjectId(id));
        } catch (e) {
          console.warn(`Invalid ObjectId format: ${id}`);
        }
      }

      // Build the query for updates repository
      const query: any = {};
      if (userObjectIds.length > 0 && workspaceIds.size > 0) {
        query.$or = [
          { createdBy: { $in: userObjectIds } },
          { workspaceId: { $in: Array.from(workspaceIds) } },
        ];
      } else if (userObjectIds.length > 0) {
        query.createdBy = { $in: userObjectIds };
      } else if (workspaceIds.size > 0) {
        query.workspaceId = { $in: Array.from(workspaceIds) };
      } else {
        return {
          activities: [],
          totalCount: 0,
          currentPage: page,
          totalPages: 0,
          limit: limit,
        };
      }

      // Fetch updates using simplified repository method
      const { updates, total } = await this.adminUpdatesRepository.findUpdates(
        query,
        page,
        limit,
      );

      // Extract unique creator IDs from the updates
      const uniqueUserIds = new Set<string>();
      updates.forEach((update) => {
        if (update.createdBy) {
          uniqueUserIds.add(update.createdBy.toString());
        }
      });

      // Fetch user details for those IDs
      const userObjectIdsToFetch = Array.from(uniqueUserIds)
        .map((id) => {
          try {
            return new ObjectId(id);
          } catch (e) {
            console.warn(`Invalid user ObjectId: ${id}`);
            return null;
          }
        })
        .filter(Boolean);

      const users =
        await this.adminUserRepository.findUsersByIds(userObjectIdsToFetch);

      // Create a user lookup map in the service
      const userMap: { [userId: string]: any } = {};
      users.forEach((user) => {
        userMap[user._id.toString()] = {
          _id: user._id,
          name: user.name,
          email: user.email,
        };
      });

      // Attach user info to each update in the service
      const activities = updates.map((update) => {
        const userId = update.createdBy ? update.createdBy.toString() : null;
        return {
          ...update,
          user: userId && userMap[userId] ? userMap[userId] : null,
        };
      });

      return {
        activities,
        totalCount: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      console.error("Error fetching user activities:", error);
      throw new InternalServerErrorException("Failed to fetch user activities");
    }
  }

  /**
   * Get user distribution data for pie chart visualization
   * @param userId The admin user ID
   * @returns Formatted data for user distribution pie chart
   */
  async getUserDistribution(userId: string) {
    const teams = await this.teamsRepo.findTeamsByUserId(userId);

    if (!teams.data.length) {
      throw new NotFoundException("No teams found for this user");
    }

    // Track unique users by their highest role
    const userHighestRoleMap = new Map<
      string,
      TeamRole.ADMIN | TeamRole.MEMBER
    >();

    // First pass: determine each user's highest role
    for (const hub of teams.data) {
      for (const user of hub.users) {
        const userId = user.id.toString();
        const role =
          user.role === TeamRole.OWNER || user.role === TeamRole.ADMIN
            ? TeamRole.ADMIN
            : TeamRole.MEMBER;

        if (!userHighestRoleMap.has(userId)) {
          userHighestRoleMap.set(userId, role);
        } else if (
          userHighestRoleMap.get(userId) === TeamRole.MEMBER &&
          role === TeamRole.ADMIN
        ) {
          // Upgrade role to admin if previously marked as member
          userHighestRoleMap.set(userId, TeamRole.ADMIN);
        }
      }
    }

    // Count unique users by role
    let adminCount = 0;
    let memberCount = 0;

    userHighestRoleMap.forEach((role) => {
      if (role === TeamRole.ADMIN) {
        adminCount++;
      } else {
        memberCount++;
      }
    });

    // Format for pie chart
    return [
      {
        label: "Admin",
        value: adminCount,
        color: "#2B9ACA",
        uniqueUsers: true,
      },
      {
        label: "Members",
        value: memberCount,
        color: "#CA2689",
        uniqueUsers: true,
      },
    ];
  }

  /**
   * Get user role trend data for line graph visualization
   */
  async getUserRoleTrends(userId: string) {
    try {
      // Get all teams where the user is owner or admin
      const teams = await this.teamsRepo.findTeamsByUserId(userId);

      if (!teams.data || teams.data.length === 0) {
        throw new NotFoundException("No teams found for this user");
      }

      // Generate dates for the past 11 months plus current month's 1st day and today
      const datePoints = [];
      const now = new Date();

      // Add first day of each month for the past 11 months
      for (let i = 11; i >= 1; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        datePoints.push({
          date: month.toISOString().slice(0, 10),
          month: month,
        });
      }

      // Add first day of current month
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      datePoints.push({
        date: firstDayThisMonth.toISOString().slice(0, 10),
        month: firstDayThisMonth,
      });

      // Add today as the final data point
      datePoints.push({
        date: now.toISOString().slice(0, 10),
        month: now,
      });

      // Initialize result structure with two series
      const adminSeries = {
        name: "Admin",
        color: "#30A5D6",
        data: datePoints.map((dp) => ({
          date: dp.date,
          value: 0,
        })),
      };

      const memberSeries = {
        name: "Member",
        color: "#E5259B",
        data: datePoints.map((dp) => ({
          date: dp.date,
          value: 0,
        })),
      };

      // For each date point, count unique users who had joined by that date
      datePoints.forEach((dp, index) => {
        // Track unique users by ID and role
        const userRoleMap = new Map<string, TeamRole.ADMIN | TeamRole.MEMBER>();

        // Loop through each team
        for (const team of teams.data) {
          // Get team creation date
          const teamCreatedAt = team.createdAt
            ? new Date(team.createdAt)
            : null;

          // Only include teams that existed by this date point
          if (!teamCreatedAt || teamCreatedAt > dp.month) {
            continue;
          }

          // Track unique users in this team/hub as of this date
          for (const user of team.users || []) {
            // Get user join date (default to team creation if not specified)
            const userJoinedAt = user.joinedAt
              ? new Date(user.joinedAt)
              : teamCreatedAt;

            // Only count users who had joined by this date point
            if (userJoinedAt && userJoinedAt <= dp.month) {
              const userId = user.id.toString();
              const role =
                user.role === TeamRole.OWNER || user.role === TeamRole.ADMIN
                  ? TeamRole.ADMIN
                  : TeamRole.MEMBER;

              if (!userRoleMap.has(userId)) {
                userRoleMap.set(userId, role);
              } else if (
                userRoleMap.get(userId) === TeamRole.MEMBER &&
                role === TeamRole.ADMIN
              ) {
                // Upgrade to admin if previously marked as member
                userRoleMap.set(userId, TeamRole.ADMIN);
              }
            }
          }
        }

        // Count unique users by role
        let adminCount = 0;
        let memberCount = 0;

        userRoleMap.forEach((role) => {
          if (role === TeamRole.ADMIN) {
            adminCount++;
          } else {
            memberCount++;
          }
        });

        // Update the series data
        adminSeries.data[index].value = adminCount;
        memberSeries.data[index].value = memberCount;
      });

      return {
        series: [adminSeries, memberSeries],
      };
    } catch (error) {
      console.error("Error generating user role trend data:", error);
      throw new InternalServerErrorException("Failed to generate trend data");
    }
  }
}
