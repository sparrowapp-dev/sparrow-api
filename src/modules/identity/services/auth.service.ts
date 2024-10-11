import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { LoginPayload } from "../payloads/login.payload";
import { ConfigService } from "@nestjs/config";
import { Db, ObjectId, WithId } from "mongodb";
import { ContextService } from "@src/modules/common/services/context.service";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { createHmac } from "crypto";
import { User } from "@src/modules/common/models/user.model";
import { Logger } from "nestjs-pino";
import { UserRepository } from "../repositories/user.repository";
import { ErrorMessages } from "@src/modules/common/enum/error-messages.enum";
/**
 * Models a typical Login/Register route return body
 */
export interface ITokenReturnBody {
  /**
   * When the token is to expire in seconds
   */
  expires: string;
  /**
   * A human-readable format of expires
   */
  expiresPrettyPrint: string;
  /**
   * The Bearer token
   */
  token: string;
}

/**
 * Authentication Service
 */
@Injectable()
export class AuthService {
  /**
   * Time in seconds when the token is to expire
   * @type {string}
   */
  private readonly expiration: number;
  private readonly refreshTokenExpirationTime: number;
  private readonly refreshTokenMaxLimit: number;

  /**
   * Constructor
   * @param {JwtService} jwtService jwt service
   * @param {ConfigService} configService
   */
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userReposistory: UserRepository,
    @Inject("DATABASE_CONNECTION")
    private db: Db,
    private contextService: ContextService,
    private readonly logger: Logger,
  ) {
    this.expiration = this.configService.get("app.jwtExpirationTime");
    this.refreshTokenExpirationTime = this.configService.get(
      "app.refreshTokenExpirationTime",
    );
    this.refreshTokenMaxLimit = this.configService.get(
      "app.refreshTokenMaxLimit",
    );
  }

  /**
   * Creates a signed jwt token based on IUser payload
   * @param {acknowledged} param
   * @param {insertedId} param id of document
   * @returns {Promise<ITokenReturnBody>} token body
   */
  async createToken(insertedId: ObjectId): Promise<ITokenReturnBody> {
    const user = await this.userReposistory.getUserById(insertedId.toString());
    return {
      expires: this.expiration.toString(),
      expiresPrettyPrint: AuthService.prettyPrintSeconds(
        this.expiration.toString(),
      ),
      token: this.jwtService.sign(
        {
          _id: insertedId,
          email: user.email,
          name: user.name,
          exp: Date.now() / 1000 + this.expiration,
        },
        { secret: this.configService.get("app.jwtSecretKey") },
      ),
    };
  }

  async createRefreshToken(insertedId: ObjectId): Promise<ITokenReturnBody> {
    const user = await this.userReposistory.getUserById(insertedId.toString());
    const data = {
      expires: this.refreshTokenExpirationTime.toString(),
      expiresPrettyPrint: AuthService.prettyPrintSeconds(
        this.refreshTokenExpirationTime.toString(),
      ),
      token: this.jwtService.sign(
        {
          _id: insertedId,
          email: user.email,
          name: user.name,
          exp: Date.now() / 1000 + this.refreshTokenExpirationTime,
        },
        { secret: this.configService.get("app.refreshTokenSecretKey") },
      ),
    };
    await this.userReposistory.addRefreshTokenInUser(
      user._id,
      createHmac("sha256", data.token).digest("hex"),
    );
    return data;
  }
  /**
   * Formats the time in seconds into human-readable format
   * @param {string} time
   * @returns {string} hrf time
   */
  private static prettyPrintSeconds(time: string): string {
    const ntime = Number(time);
    const hours = Math.floor(ntime / 3600);
    const minutes = Math.floor((ntime % 3600) / 60);
    const seconds = Math.floor((ntime % 3600) % 60);

    return `${hours > 0 ? hours + (hours === 1 ? " hour," : " hours,") : ""} ${
      minutes > 0 ? minutes + (minutes === 1 ? " minute" : " minutes") : ""
    } ${seconds > 0 ? seconds + (seconds === 1 ? " second" : " seconds") : ""}`;
  }

  /**
   * Validates whether or not the User exists in the database
   * @param {LoginPayload} payload login payload to authenticate with
   * @returns {Promise<IUser>} registered User
   */
  async validateUser(payload: LoginPayload): Promise<WithId<User>> {
    payload.email = payload.email.toLowerCase();
    const user = await this.getUserByEmailAndPass(
      payload.email,
      payload.password,
    );
    if (!user) {
      throw new BadRequestException(
        "Could not authenticate. Please try again.",
      );
    }
    this.contextService.set("user", user);
    return user;
  }
  async getUserByEmailAndPass(
    email: string,
    password: string,
  ): Promise<WithId<User>> {
    return await this.db.collection<User>(Collections.USER).findOne({
      email,
      password: createHmac("sha256", password).digest("hex"),
    });
  }

  async validateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<Record<string, ITokenReturnBody>> {
    const _id = new ObjectId(userId);
    const user = await this.db
      .collection<User>(Collections.USER)
      .findOne({ _id });

    if (!user) {
      throw new UnauthorizedException(ErrorMessages.JWTFailed);
    }
    const oldRefreshToken = user.refresh_tokens.filter((token) => {
      if (createHmac("sha256", refreshToken).digest("hex") === token) {
        return token;
      }
    });
    if (!oldRefreshToken) {
      throw new ForbiddenException("Access Denied");
    }
    const tokenPromises = [
      this.createToken(user._id),
      this.createRefreshToken(user._id),
    ];
    const [newAccessToken, newRefreshToken] = await Promise.all(tokenPromises);

    await this.userReposistory.deleteRefreshToken(
      user._id.toString(),
      oldRefreshToken[0],
    );
    return {
      newAccessToken,
      newRefreshToken,
    };
  }

  async checkRefreshTokenLimit(user: User): Promise<void> {
    if (user.refresh_tokens.length === this.refreshTokenMaxLimit) {
      throw new BadRequestException("Maximum request limit reached");
    }
  }
}
