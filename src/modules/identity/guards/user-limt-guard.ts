// user-limit.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { TeamRepository } from "@src/modules/identity/repositories/team.repository";
import { UserLimitService } from "@src/modules/workspace/services/userLimit.service";
import { LimitCheckResult } from "@src/modules/common/enum/user-limit-enum";

@Injectable()
export class UserLimitGuard implements CanActivate {
  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly userLimitService: UserLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const RequestUser = req.user;

    const teamId = req.body?.teamId;
    const emailId = RequestUser.email;

    if (!teamId || !emailId) {
      throw new ForbiddenException("Missing teamId or emailId.");
    }

    const teamData = await this.teamRepository.get(teamId);
    if (!teamData || !teamData.users) {
      throw new ForbiddenException("Team not found or invalid.");
    }

    const user = teamData.users.find((u: any) => u.email === emailId);
    if (!user) {
      throw new ForbiddenException("User not found in team.");
    }

    const planId = teamData.plan.id?.toString();

    const status = await this.userLimitService.checkLimitAndLogRequest(
      user.id,
      teamId,
      planId,
    );

    if (status === LimitCheckResult.LIMIT_REACHED) {
      throw new ForbiddenException("Limit reached. Please try again later.");
    }

    return true;
  }
}
