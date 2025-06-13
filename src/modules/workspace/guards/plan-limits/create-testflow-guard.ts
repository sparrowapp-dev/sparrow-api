import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";
import { PlanService } from "@src/modules/identity/services/plan.service";

@Injectable()
export class CreateTestflowGuard implements CanActivate {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly planService: PlanService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userWorkspaceId = request?.body?.workspaceId;
    const workspaceDetails = await this.workspaceService.get(userWorkspaceId);
    const planData = await this.planService.get(
      workspaceDetails?.plan?.id.toString(),
    );
    if (
      workspaceDetails?.testflows?.length >=
      planData?.limits?.testflowPerWorkspace?.value
    ) {
      throw new ForbiddenException("Plan limit reached");
    }
    return true;
  }
}
