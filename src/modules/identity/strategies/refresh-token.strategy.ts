import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { FastifyRequest } from "fastify";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get("app.refreshTokenSecretKey"),
      passReqToCallback: true,
    });
  }

  validate(req: FastifyRequest, payload: any) {
    const refreshToken = req.headers.authorization.replace("Bearer", "").trim();

    return { _id: payload._id, refreshToken };
  }
}
