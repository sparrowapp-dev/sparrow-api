import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-microsoft";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, "microsoft") {
  constructor(private readonly configService: ConfigService) {
    const microsoftClientId = configService.get("oauth.microsoft.clientId");
    const microsoftClientSecret = configService.get(
      "oauth.microsoft.clientSecret",
    );
    const microsoftAppUrl = configService.get("oauth.microsoft.appUrl");
    const callbackUrl = `${microsoftAppUrl}/api/auth/microsoft/callback`;

    super({
      clientID: microsoftClientId,
      clientSecret: microsoftClientSecret,
      callbackURL: callbackUrl,
      // redirect: "http://localhost:1421/redirect",
      scope: ["openid", "profile", "email", "User.Read"],
      tenant: "common",
      identityMetadata:
        "https://login.microsoftonline.com/consumers/v2.0/.well-known/openid-configuration",
      responseType: "code",
      responseMode: "query",
      validateIssuer: false,
      passReqToCallback: false,
      prompt: "consent",
    });
  }

  // authorizationParams() {
  //   return {
  //     prompt: "consent",
  //     accessType: "offline",
  //   };
  // }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    if (!profile) {
      throw new Error("Profile not received from Microsoft");
    }
    const { id, emails, displayName } = profile;
    const user = {
      microsoftId: id,
      name: displayName,
      email: emails[0].value,
    };

    console.log("user in microsoft-strategy", user.name);
    return user;
  }
}
