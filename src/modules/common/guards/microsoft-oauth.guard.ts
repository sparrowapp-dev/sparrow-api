//microsoft-oauth.guard.ts
import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

// @Injectable()
// export class MicrosoftOAuthGuard extends AuthGuard("microsoft") {
//   handleRequest(err: string, user: any, info: any, context: ExecutionContext) {
//     console.log("handle---", user, err, info, context);
//     const request = context.switchToHttp().getRequest();
//     const error = request.query.error;
//     if (error) {
//       return error;
//     }
//     return user;
//   }
// }
@Injectable()
export class MicrosoftOAuthGuard extends AuthGuard("microsoft") {
  handleRequest(err: string, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    console.log("handleRequest invoked");
    console.log("< -----Error ---- >:", err);
    console.log("< ----User: ---->", user);
    console.log("> ----Info: ---- >", info);

    const error = request.query.error;

    if (error) {
      console.error("Error in request query:", error);
      return error;
    }

    if (err || !user) {
      console.error("Error or no user found:", err || "No user");
      return null;
    }

    return user;
  }
}
