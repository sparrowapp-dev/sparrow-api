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
    const MAX_TOTAL_TRIAL_DAYS = 180;

    const currentTrialEnd = new Date(team.billing.current_period_end);

    if (!currentTrialEnd) {
      throw new BadRequestException("Trial end date not found");
    }

    // Calculate new trial end
    const newTrialEnd = new Date(
      currentTrialEnd.getTime() + extensionDays * 24 * 60 * 60 * 1000,
    );

    // Validate total trial duration
    const trialStart = new Date(team.billing.current_period_start);

    const maxAllowedTrialEnd = new Date(
      trialStart.getTime() + MAX_TOTAL_TRIAL_DAYS * 24 * 60 * 60 * 1000,
    );

    if (newTrialEnd > maxAllowedTrialEnd) {
      throw new BadRequestException(
        `Trial cannot exceed ${MAX_TOTAL_TRIAL_DAYS} days from start`,
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

    if (!currentTrialEnd) {
      throw new BadRequestException("Trial end date not found");
    }

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
        const emails = team.users?.map((u: any) => u.email) || [];

        if (emails) {
          await this.paymentEmailService.sendPaymentEmail(
            PaymentEmailType.TRIAL_EXTENDED,
            {
              sendEmails: emails,
              hubName: team.name,
              planName: team.plan?.name,
              billingPeriodStart: team.billing.current_period_start,
              billingPeriodEnd: newTrialEnd,
              totalSeats: team.billing?.seats || 1,
            },
          );
        }
      } catch (error) {
        console.warn("Failed to send trial extension email", error);
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

  async addPlanToHub(
    hubId: string,
    planId: string,
    effectiveDate: string,
    billingCycle: string,
    notes?: string,
  ) {
    // Validate hub exists
    const team = await this.teamsRepo.findHubById(hubId);

    if (!team) {
      throw new NotFoundException("Hub not found");
    }

    // Validate plan exists
    const plan = await this.teamsRepo.findPlanById(planId);

    if (!plan) {
      throw new BadRequestException("Plan not found or inactive");
    }
    //Prevent adding same plan again
    const currentPlan = team.plan?.name;

    if (currentPlan === plan.name) {
      throw new BadRequestException(`Hub already has ${plan.name} plan`);
    }

    // Calculate proration
    let proratedAmount = 0;

    const billingStart = new Date(team.billing?.current_period_start);
    const billingEnd = new Date(team.billing?.current_period_end);
    const effective = new Date(effectiveDate);

    const totalPeriod = billingEnd.getTime() - billingStart.getTime();

    const remainingPeriod = billingEnd.getTime() - effective.getTime();

    if (remainingPeriod > 0) {
      const remainingRatio = remainingPeriod / totalPeriod;

      const planPrice = plan.price || 0;

      proratedAmount = Math.round(planPrice * remainingRatio);
    }
    // Get Stripe subscription
    const stripeProvider = team.billing?.paymentProviders?.find(
      (p: any) => p.provider === PaymentProvider.STRIPE,
    );

    const subscriptionId = stripeProvider?.subscriptionId;

    // If no Stripe subscription (community/self-host hubs)
    if (!subscriptionId) {
      proratedAmount = 0;
    }

    // Update Stripe subscription with new plan
    if (subscriptionId && !subscriptionId.startsWith("sub_test")) {
      await this.stripeSubscriptionService["stripeService"].updateSubscription(
        subscriptionId,
        undefined,
        {
          hubId: hubId,
          newPlan: plan.name,
          billingCycle,
          effectiveDate,
          notes,
        },
      );
    }

    // Update hub plan in database
    await this.teamsRepo.updateHubPlan(hubId, plan);

    // Record billing audit
    await this.billingAuditService.recordSubscriptionCreated(
      hubId,
      plan.name,
      {
        proratedAmount,
        billingCycle,
        effectiveDate,
      },
      {
        actor: {
          type: BillingActorType.SYSTEM,
          name: "Admin Plan Addition",
        },
        source: BillingSource.API_CALL,
        reason: notes || "Admin added plan",
      },
    );

    // Send notification email
    try {
      const owner = team.users?.find((u: any) => u.role === "owner");

      if (owner) {
        await this.paymentEmailService.sendPaymentEmail(
          PaymentEmailType.PLAN_ADDED,
          {
            ownerEmail: owner.email,
            ownerName: owner.name,
            hubName: team.name,
            planName: plan.name,

            price: plan.price || 0,
            interval: billingCycle || "month",

            upgradeDate: new Date(effectiveDate).toDateString(),

            nextBillingDate: team.billing?.current_period_end
              ? new Date(team.billing.current_period_end).toDateString()
              : "",

            features: [
              `Up to ${plan.limits?.workspacesPerHub?.value || "multiple"} workspaces`,
              "Unlimited collaborators",
              "Private hubs",
              "Unlimited collections",
            ],
          },
        );
      }
    } catch (error) {
      console.warn("Failed to send plan addition email", error);
    }

    return {
      hubId,
      previousPlan: currentPlan,
      newPlan: plan.name,
      effectiveDate,
      billingCycle,
      proratedAmount,
    };
  }

  async changeHubPlan(
    hubId: string,
    currentPlanId: string,
    newPlanId: string,
    changeType: string,
    effectiveDate: string,
    prorate: boolean,
  ) {
    // Validate hub
    const team = await this.teamsRepo.findHubById(hubId);

    if (!team) {
      throw new NotFoundException("Hub not found");
    }

    // Fetch plans
    const currentPlan = await this.teamsRepo.findPlanById(currentPlanId);
    const newPlan = await this.teamsRepo.findPlanById(newPlanId);

    if (!currentPlan || !newPlan) {
      throw new BadRequestException("Invalid plan");
    }

    // Validate hub current plan
    if (team.plan?.id.toString() !== currentPlanId) {
      throw new BadRequestException(
        "Hub does not currently have the specified plan",
      );
    }

    // Determine plan hierarchy
    const currentPlanTier = currentPlan.limits?.workspacesPerHub?.value || 0;

    const newPlanTier = newPlan.limits?.workspacesPerHub?.value || 0;

    if (changeType === "upgrade" && newPlanTier <= currentPlanTier) {
      throw new BadRequestException(
        "New plan must be higher than current plan for upgrade",
      );
    }

    if (changeType === "downgrade" && newPlanTier >= currentPlanTier) {
      throw new BadRequestException(
        "New plan must be lower than current plan for downgrade",
      );
    }

    let proratedAmount = 0;

    if (prorate) {
      const billingStart = new Date(team.billing?.current_period_start);
      const billingEnd = new Date(team.billing?.current_period_end);
      const effective = new Date(effectiveDate);

      const totalPeriod = billingEnd.getTime() - billingStart.getTime();

      const remainingPeriod = billingEnd.getTime() - effective.getTime();

      if (remainingPeriod > 0) {
        const ratio = remainingPeriod / totalPeriod;

        const currentPrice = currentPlan.price || 0;
        const newPrice = newPlan.price || 0;

        proratedAmount = Math.round((newPrice - currentPrice) * ratio);
      }
    }

    const stripeProvider = team.billing?.paymentProviders?.find(
      (p: any) => p.provider === PaymentProvider.STRIPE,
    );

    const subscriptionId = stripeProvider?.subscriptionId;

    // Update Stripe subscription if exists
    if (subscriptionId && !subscriptionId.startsWith("sub_test")) {
      await this.stripeSubscriptionService["stripeService"].updateSubscription(
        subscriptionId,
        undefined,
        {
          hubId,
          newPlan: newPlan.name,
          changeType,
          proratedAmount,
          effectiveDate,
          updatedByAdmin: true,
        },
      );
    }

    await this.teamsRepo.updateHubPlan(hubId, newPlan);

    await this.billingAuditService.recordSubscriptionCreated(
      hubId,
      newPlan.name,
      {
        changeType,
        proratedAmount,
        effectiveDate,
      },
      {
        actor: {
          type: BillingActorType.SYSTEM,
          name: "Admin Plan Change",
        },
        source: BillingSource.API_CALL,
        reason: `Admin ${changeType}`,
      },
    );
    try {
      const owner = team.users?.find((u: any) => u.role === "owner");

      if (owner) {
        await this.paymentEmailService.sendPaymentEmail(
          PaymentEmailType.PLAN_ADDED,
          {
            ownerEmail: owner.email,
            ownerName: owner.name,
            hubName: team.name,
            planName: newPlan.name,
            price: newPlan.price || 0,
            interval: "month",

            upgradeDate: new Date(effectiveDate).toDateString(),

            nextBillingDate: team.billing?.current_period_end
              ? new Date(team.billing.current_period_end).toDateString()
              : "",

            features: [
              `Up to ${newPlan.limits?.workspacesPerHub?.value || "multiple"} workspaces`,
              "Unlimited collaborators",
              "Private hubs",
              "Unlimited collections",
            ],
          },
        );
      }
    } catch (error) {
      console.warn("Failed to send plan change email", error);
    }

    return {
      hubId,
      previousPlan: currentPlan.name,
      newPlan: newPlan.name,
      changeType,
      effectiveDate,
      proratedAmount,
    };
  }
}
