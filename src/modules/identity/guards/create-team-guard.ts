import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TeamService } from "@src/modules/identity/services/team.service";

@Injectable()
export class CreateTeamGuard implements CanActivate {
  constructor(
    private readonly teamService: TeamService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const defaultHubPlan = this.configService.get<string>("app.defaultHubPlan");

    const user = request.user;
    const userTeams = await this.teamService.getAllTeams(user._id.toString());

    let communityPlansCount = 0;
    const ownedTeams = userTeams.filter((team) => {
      if (team.owner === user._id.toString()) {
        if(team.plan.name === defaultHubPlan){
          communityPlansCount = communityPlansCount + 1;
        }
        return true;
      };
      return false;
    });
    if (ownedTeams.length === communityPlansCount) { // if user has 'n' owned hub and all are community then throw error.
      throw new ForbiddenException("Plan limit reached");
    }
    return true;
  }
}
