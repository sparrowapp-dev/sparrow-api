import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { TeamService } from "@src/modules/identity/services/team.service";

@Injectable()
export class HubBulkInviteGuard implements CanActivate {
  constructor(private readonly teamService: TeamService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const requestUsers = request?.body?.users;
    const teamId = request?.body?.teamId || request?.params?.teamId;
    const teamUserEmails = new Set<string>();

    const userTeam = await this.teamService.get(teamId);
    userTeam?.users?.forEach((user) => {
      if (user.email) teamUserEmails.add(user.email.toLowerCase());
    });
    userTeam?.invites?.forEach((invite) => {
      if (invite.email) teamUserEmails.add(invite.email.toLowerCase());
    });
    if (Array.isArray(requestUsers)) {
      requestUsers.forEach((user) => {
        // user can be an object with email property
        if (typeof user === "object" && user.email) {
          teamUserEmails.add(user.email.toLowerCase());
        }
      });
    }

    const planData = userTeam?.plan;
    const maxUsers = planData?.limits?.usersPerHub?.value ?? 0;
    if (teamUserEmails.size > maxUsers + 1) {
      throw new ForbiddenException("Plan limit reached");
    }
    return true;
  }
}
