import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PlanService } from "@src/modules/identity/services/plan.service";
import { TeamService } from "@src/modules/identity/services/team.service";

@Injectable()
export class HubInviteGuard implements CanActivate {
  constructor(
    private readonly teamService: TeamService,
    private readonly planService: PlanService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const requestUsers = request?.body.users;
    const teamId = request?.body?.teamId;
    const teamUserEmails = new Set();
    const userTeam = await this.teamService.get(teamId);
    userTeam?.users?.forEach((user) => {
      teamUserEmails.add(user.email.toLowerCase());
    });
    userTeam?.invites?.forEach((invites) => {
      teamUserEmails.add(invites.email.toLowerCase());
    });
    requestUsers?.forEach((email: string) => {
      teamUserEmails.add(email.toLowerCase());
    });

    const teamPlanId = userTeam?.plan.id;
    const planData = await this.planService.get(teamPlanId.toString());
    if (teamUserEmails.size > planData?.limits?.usersPerHub?.value + 1) {
      throw new ForbiddenException("Plan limit reached");
    }
    return true;
  }
}
