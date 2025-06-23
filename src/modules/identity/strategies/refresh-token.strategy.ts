import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { FastifyRequest } from "fastify";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ErrorMessages } from "@src/modules/common/enum/error-messages.enum";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db, ObjectId } from "mongodb";

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(
    readonly configService: ConfigService,
    @Inject("DATABASE_CONNECTION")
    private db: Db,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get("app.refreshTokenSecretKey"),
      passReqToCallback: true,
    });
  }

  async validate(req: FastifyRequest, payload: any) {
    const { _id, exp } = payload;
    const refreshToken = req.headers.authorization.replace("Bearer", "").trim();
    const timeDiff = exp - Date.now() / 1000;
    if (timeDiff <= 0) {
      throw new UnauthorizedException(ErrorMessages.ExpiredToken);
    }
    const user = await this.db.collection(Collections.USER).findOne(
      {
        _id: new ObjectId(_id),
      },
      { projection: { password: 0, refresh_tokens: 0, verificationCode: 0 } },
    );

    if (!user) {
      throw new UnauthorizedException(ErrorMessages.JWTFailed);
    }

    return { _id: payload._id, refreshToken };
  }
}
