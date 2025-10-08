import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";
import { PlanService } from "@src/modules/identity/services/plan.service";
import { TeamService } from "@src/modules/identity/services/team.service";
import { TestflowRepository } from "../../repositories/testflow.repository";

@Injectable()
export class CreateTestflowScheduleGuard implements CanActivate {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly teamService: TeamService,
    private readonly testflowRepository: TestflowRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const workspaceDetails = await this.workspaceService.get(
      request?.body?.workspaceId,
    );
    const teamId = workspaceDetails.team.id;
    const userTeam = await this.teamService.get(teamId);
    const planData = userTeam?.plan;
    const testflow = await this.testflowRepository.get(
      request?.body?.testflowId,
    );
    if (
      Array.isArray(testflow?.schedules) &&
      testflow.schedules.length >=
        (planData?.limits?.testflowPerWorkspace?.value ?? 0)
    ) {
      throw new ForbiddenException("Plan limit reached");
    }
    return true;
  }
}
