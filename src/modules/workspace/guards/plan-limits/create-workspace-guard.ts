import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { TeamService } from "@src/modules/identity/services/team.service";
import { PlanService } from "@src/modules/identity/services/plan.service";

@Injectable()
export class CreateWorkspaceGuard implements CanActivate {
  constructor(
    private readonly teamService: TeamService,
    private readonly planService: PlanService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const teamId = request?.body?.id;
    const usersTeamdetails = await this.teamService.get(teamId);
    const teamPlanId = usersTeamdetails?.plan.id;
    const planData = await this.planService.get(teamPlanId.toString());
    if (
      usersTeamdetails?.workspaces?.length >=
      planData?.limits?.workspacesPerHub?.value
    ) {
      throw new ForbiddenException("Plan limit reached");
    }
    return true;
  }
}
