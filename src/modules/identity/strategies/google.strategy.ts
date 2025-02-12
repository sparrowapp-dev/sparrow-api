import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private readonly configService: ConfigService) {
    const googleClientId = configService.get("oauth.google.clientId");
    const googleClientSecret = configService.get("oauth.google.clientSecret");
    const googleAppUrl = configService.get("oauth.google.appUrl");
    const callbackUrl = `${googleAppUrl}/api/auth/google/callback`;
    super({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: callbackUrl,
      scope: ["email", "profile"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, displayName } = profile;
    const user = {
      oAuthId: id,
      name: displayName,
      email: emails[0].value,
    };
    done(null, user);
  }
}
