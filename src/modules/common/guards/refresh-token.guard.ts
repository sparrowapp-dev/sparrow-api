import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ErrorMessages } from "../enum/error-messages.enum";

@Injectable()
export class RefreshTokenGuard extends AuthGuard("jwt-refresh") {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new UnauthorizedException(ErrorMessages.Unauthorized);
    }
    return user;
  }
}
