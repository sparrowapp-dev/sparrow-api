import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Db, ObjectId } from "mongodb";
import { JwtPayload } from "../payloads/jwt.payload";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { ContextService } from "@src/modules/common/services/context.service";
import { ErrorMessages } from "@src/modules/common/enum/error-messages.enum";

/**
 * Jwt Strategy Class
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Constructor
   * @param {ConfigService} configService
   * @param {Db} mongodb
   */
  constructor(
    readonly configService: ConfigService,
    @Inject("DATABASE_CONNECTION")
    private db: Db,
    private contextService: ContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get("app.jwtSecretKey"),
    });
  }

  /**
   * Checks if the bearer token is a valid token
   * @param {JwtPayload} jwtPayload validation method for jwt token
   * @param {any} done callback to resolve the request user with
   * @returns {Promise<boolean>} whether or not to validate the jwt token
   */
  async validate({ iat, exp, _id }: JwtPayload) {
    const timeDiff = exp - iat;
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
      throw new UnauthorizedException(ErrorMessages.Unauthorized);
    }
    this.contextService.set("user", user);

    return user._id;
  }
}
