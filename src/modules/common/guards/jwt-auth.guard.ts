import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ErrorMessages } from "../enum/error-messages.enum";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info.name === ErrorMessages.TokenExpiredError) {
        throw new UnauthorizedException(ErrorMessages.ExpiredToken);
      }
      throw new UnauthorizedException(ErrorMessages.Unauthorized);
    }

    return user;
  }
}
