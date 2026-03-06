import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ObjectId } from "mongodb";

import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { AdminWorkspaceRepository } from "../repositories/user-admin.workspace.repository";
import { TeamRole } from "@src/modules/common/enum/roles.enum";
import { PlanName } from "@src/modules/common/enum/plan.enum";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import { StripeSubscriptionService } from "@src/modules/billing/services/stripe-subscription.service";
import { BillingAuditService } from "@src/modules/billing/services/billing-audit.service";
import {
  PaymentEmailService,
  PaymentEmailType,
} from "@src/modules/billing/services/payment-email.service";
import {
  BillingActorType,
  BillingSource,
  PaymentProvider,
} from "@src/modules/common/enum/billing.enum";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";

interface SortOptions {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

@Injectable()
export class AdminHubsService {
  constructor(
    private readonly teamsRepo: AdminHubsRepository,
    private readonly workspaceRepo: AdminWorkspaceRepository,
    private readonly userRepo: UserRepository,
    private readonly stripeSubscriptionService: StripeSubscriptionService,
    private readonly billingAuditService: BillingAuditService,
    private readonly paymentEmailService: PaymentEmailService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
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
        plan: team?.plan?.name,
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
    const planSegregationCount = {
      [PlanName.COMMUNITY]: 0,
      [PlanName.STANDARD]: 0,
      [PlanName.PROFESSIONAL]: 0,
    };

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

      const planName = hub?.plan?.name;
      //Matching with the plan title nad increasing the respective count
      if (Object.values(PlanName).includes(planName as PlanName)) {
        const key = planName as PlanName;
        planSegregationCount[key] += 1;
      }
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
      planSegregationCount,
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
    plan: string,
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
        plan,
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
      const getUser = await this.userRepo?.getUserById(userId);
      const userTeams = await Promise.all(
        teams.data.map(async (team) => {
          const workspaceStats = {
            total: team.workspaces?.length || 0,
            private: 0,
            public: 0,
          };
          const userWorkspaceIds =
            getUser?.workspaces?.map((w) => w.workspaceId?.toString()) || [];

          const selectedWorkspaces = team.workspaces.filter((w: any) =>
            userWorkspaceIds.includes(w?.id?.toString()),
          );
          const workspaces = await Promise.all(
            (selectedWorkspaces || []).map(async (workspace: any) => {
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
            plan: team?.plan,
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

  async getTeamStatistics(teamId: string) {
    const team = await this.teamsRepo.findHubById(teamId);

    if (!team) {
      throw new NotFoundException("Hub not found");
    }

    // Count collaborators excluding owners
    const collaboratorCount = team.users.filter(
      (user: any) => user.role !== TeamRole.OWNER,
    ).length;

    return {
      teamId: team._id,
      teamName: team.name,
      collaboratorCount,
      workspaceCount: team.workspaces?.length || 0,
      pendingInvites: team.invites?.length || 0,
    };
  }

  /**
   * Submit feedback for a hub
   * @param hubId The hub ID
   * @param feedback The feedback string
   * @returns Success result
   */
  async submitHubFeedback(hubId: string, feedback: string) {
    const hub = await this.teamsRepo.findHubById(hubId);

    if (!hub) {
      throw new NotFoundException("Hub not found");
    }

    const updateResult = await this.teamsRepo.updateTeamFeedback(
      hubId,
      feedback,
    );

    if (updateResult.modifiedCount === 0) {
      throw new Error("Failed to save feedback");
    }

    return { success: true };
  }

  async extendTrial(
    hubId: string,
    extensionDays: number,
    reason: string,
    notifyCustomer?: boolean,
  ) {
    // Validate hub exists
    const team = await this.teamsRepo.findHubById(hubId);

    if (!team) {
      throw new NotFoundException("Hub not found");
    }

    // Validate trial status
    if (team.billing?.in_trial !== true) {
      throw new BadRequestException("Hub is not currently in trial");
    }

    // Validate extension limits
    const MAX_TRIAL_EXTENSION_DAYS = 100;

    if (extensionDays <= 0 || extensionDays > MAX_TRIAL_EXTENSION_DAYS) {
      throw new BadRequestException(
        `Trial extension must be between 1 and ${MAX_TRIAL_EXTENSION_DAYS} days`,
      );
    }

    // Get Stripe subscription
    const stripeProvider = team.billing?.paymentProviders?.find(
      (p: any) => p.provider === PaymentProvider.STRIPE,
    );

    if (!stripeProvider?.subscriptionId) {
      throw new BadRequestException("Stripe subscription not found for hub");
    }

    const subscriptionId = stripeProvider.subscriptionId;

    let currentTrialEnd: Date;

    // Local development bypass
    if (subscriptionId.startsWith("sub_test")) {
      currentTrialEnd = new Date(team.billing.current_period_end);
    } else {
      const subscription =
        await this.stripeSubscriptionService["stripeService"].getSubscription(
          subscriptionId,
        );

      if (!subscription?.trial_end) {
        throw new BadRequestException(
          "Subscription does not have an active trial",
        );
      }

      currentTrialEnd = new Date(subscription.trial_end * 1000);
    }

    // Calculate new trial end
    const newTrialEnd = new Date(
      currentTrialEnd.getTime() + extensionDays * 24 * 60 * 60 * 1000,
    );

    // Update Stripe if real subscription
    if (!subscriptionId.startsWith("sub_test")) {
      await this.stripeSubscriptionService["stripeService"].updateSubscription(
        subscriptionId,
        undefined,
        {
          hubId: hubId,
          planName: team.plan?.name,
          trial_end_date: newTrialEnd.toISOString(),
          trialExtension: "true",
          extensionDays: extensionDays.toString(),
        },
      );
    }

    // Update database billing
    await this.teamsRepo.updateHubBillingPeriod(hubId, newTrialEnd);
    console.log("ADMIN API updating billing to:", newTrialEnd);

    // Record audit event
    await this.billingAuditService.recordTrialStarted(
      hubId,
      team.plan?.name,
      {
        trialEndDate: newTrialEnd,
        seats: team.billing?.seats || 1,
      },
      {
        actor: {
          type: BillingActorType.SYSTEM,
          name: "Admin Trial Extension",
        },
        source: BillingSource.API_CALL,
        reason,
      },
    );

    // Optional email notification
    if (notifyCustomer) {
      try {
        await this.httpService.axiosRef.post(
          `${this.configService.get("app.baseURL")}/api/user-trial-confirmation-mail/${hubId}`,
        );
      } catch (error) {
        console.warn("Failed to send trial confirmation email", error);
      }
    }

    // Return response
    return {
      hubId,
      previousTrialEnd: currentTrialEnd,
      newTrialEnd,
      extensionDays,
    };
  }
}
