import { Injectable } from "@nestjs/common";
import { UserLimitRepository } from "../repositories/userLimit.repository";
import {
  LimitCheckResult,
} from "@src/modules/common/enum/user-limit-enum";
import { PlanRepository } from "@src/modules/identity/repositories/plan.repository";
import { parseWhitelistedEmailList } from "@src/modules/common/util/email.parser.util";
import { ConfigService } from "@nestjs/config";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";

/**
 * UserLimitService - Handles logic for user request limits and usage logging.
*
*  Current Mode:
* - Request limits are tracked monthly using the calendar month (YYYY-MM).
*
*  TODO Future Upgrade Plan:
* - Switch to billing-cycle-based tracking using billing.periodStart and billing.periodEnd
*   once the billing module is fully implemented.
*/
@Injectable()
export class UserLimitService {
  private whiteListUserTokenLimit: number;
  constructor(
    private readonly userLimitRepository: UserLimitRepository,
    private readonly planRepository: PlanRepository,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository
    // optional
    // private readonly contextService: ContextService,
  ) {
    this.whiteListUserTokenLimit = 100000;

  }

  /**
   * Checks if the user has reached their request limit and logs the request if allowed.
   * @param userId - ID of the user.
   * @param teamId - ID of the team.
   * @param plan - Subscription plan (e.g., 'standard', 'community', 'pro').
   * @returns 'OK' if within limit, or 'LIMIT REACHED'.
  */
 async checkLimitAndLogRequest(
   userId: string,
   teamId: string,
   planId: string,
  ): Promise<LimitCheckResult> {
    const whitelistEmails = await this.configService.get(
      "whitelist.userEmails",
    );
    let parsedWhiteListEmails: string[] = [];
    if (whitelistEmails) {
      parsedWhiteListEmails = parseWhitelistedEmailList(whitelistEmails) || [];
    }
    const currentMonth = new Date().toISOString().slice(0, 7);
    const start = new Date(`${currentMonth}-01T00:00:00Z`);
    const end = new Date(new Date(start).setMonth(start.getMonth() + 1));
    const user = await this.userRepository.getUserById(userId);
    if(parsedWhiteListEmails.includes(user.email)){

      const usageCount = await this.userLimitRepository.countRequests(
        userId,
        teamId,
        start,
        end,
      );
      // Check if user exceeded token limit
      if (
        (
          usageCount > this.whiteListUserTokenLimit)
      ) {
        return LimitCheckResult.LIMIT_REACHED;
      }

    }else{
      
      const plan = await this.planRepository.get(planId);

      // fetch limit from the plan details
      const limit = plan?.limits?.aiRequestsPerMonth?.value;
      if (typeof limit !== "number") {
        throw new Error("AI token limit not defined in plan");
      }
      // const limit = 26;
      const usageCount = await this.userLimitRepository.countRequests(
        userId,
        teamId,
        start,
        end,
      );

      if (usageCount >= limit) {
        return LimitCheckResult.LIMIT_REACHED;
      }

    }
    await this.userLimitRepository.logRequest({
      userId,
      teamId,
      requestedAt: new Date(),
    });
    return LimitCheckResult.OK;
  }
}
