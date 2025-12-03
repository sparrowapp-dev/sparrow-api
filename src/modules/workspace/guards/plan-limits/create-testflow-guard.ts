import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";
import { PlanService } from "@src/modules/identity/services/plan.service";
import { TeamService } from "@src/modules/identity/services/team.service";

@Injectable()
export class CreateTestflowGuard implements CanActivate {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly teamService: TeamService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userWorkspaceId = request?.body?.workspaceId;
    const workspaceDetails = await this.workspaceService.get(userWorkspaceId);
    
    const teamId = workspaceDetails.team.id;
    const userTeam = await this.teamService.get(teamId);
    const planData = userTeam?.plan
    if (!planData.active) {
      throw new ForbiddenException("Hub is Restricted.");
    }
    if (
      workspaceDetails?.testflows?.length >=
      planData?.limits?.testflowPerWorkspace?.value
    ) {
      throw new ForbiddenException("Plan limit reached");
    }
    return true;
  }
}
