import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";
import { PlanService } from "@src/modules/identity/services/plan.service";

@Injectable()
export class CreateTestflowBlockGuard implements CanActivate {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly planService: PlanService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const workspaceDetails = await this.workspaceService.get(
      request?.params?.workspaceId,
    );
    const planData = await this.planService.get(
      workspaceDetails?.plan?.id.toString(),
    );
    if (
      request?.body?.nodes?.length >
      planData?.limits?.blocksPerTestflow?.value + 1
    ) {
      throw new ForbiddenException("Plan limit reached");
    }
    return true;
  }
}
