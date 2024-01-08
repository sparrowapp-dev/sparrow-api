import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UpdateUserDto } from "../payloads/user.payload";
import { UserRepository } from "../repositories/user.repository";
import { RegisterPayload } from "../payloads/register.payload";
import { ConfigService } from "@nestjs/config";
import { WorkspaceType } from "@src/modules/common/models/workspace.model";
import { AuthService } from "./auth.service";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import {
  EmailServiceProvider,
  User,
} from "@src/modules/common/models/user.model";
import {
  EarlyAccessPayload,
  ResetPasswordPayload,
} from "../payloads/resetPassword.payload";
import * as nodemailer from "nodemailer";
import { InsertOneResult, ObjectId, WithId } from "mongodb";
import { createHmac } from "crypto";
import { ErrorMessages } from "@src/modules/common/enum/error-messages.enum";
import hbs = require("nodemailer-express-handlebars");
import path from "path";
import { ProducerService } from "@src/modules/common/services/kafka/producer.service";
export interface IGenericMessageBody {
  message: string;
}
/**
 * User Service
 */
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly producerService: ProducerService,
  ) {}

  /**
   * Fetches a user from database by UUID
   * @param {string} id
   * @returns {Promise<IUser>} queried user data
   */
  async getUserById(id: string): Promise<WithId<User>> {
    const data = await this.userRepository.getUserById(id);
    return data;
  }

  /**
   * Fetches a user from database by username
   * @param {string} email
   * @returns {Promise<IUser>} queried user data
   */
  async getUserByEmail(email: string): Promise<WithId<User>> {
    return await this.userRepository.getUserByEmail(email);
  }

  /**
   * Fetches a user by their email and hashed password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<IUser>} queried user data
   */
  async getUserByEmailAndPass(
    email: string,
    password: string,
  ): Promise<WithId<User>> {
    return await this.userRepository.getUserByEmailAndPass(email, password);
  }

  /**
   * Create a user with RegisterPayload fields
   * @param {RegisterPayload} payload user payload
   * @returns {Promise<IUser>} created user data
   */
  async createUser(payload: RegisterPayload) {
    const user = await this.getUserByEmail(payload.email);
    if (user) {
      throw new BadRequestException(
        "The account with the provided email currently exists. Please choose another one.",
      );
    }
    const createdUser = await this.userRepository.createUser(payload);

    const tokenPromises = [
      this.authService.createToken(createdUser.insertedId),
      this.authService.createRefreshToken(createdUser.insertedId),
    ];
    const [accessToken, refreshToken] = await Promise.all(tokenPromises);
    const data = {
      accessToken,
      refreshToken,
    };
    const workspaceObj = {
      name: this.configService.get("app.defaultWorkspaceName"),
      type: WorkspaceType.PERSONAL,
    };
    await this.producerService.produce(TOPIC.CREATE_USER_TOPIC, {
      value: JSON.stringify(workspaceObj),
    });
    return data;
  }

  /**
   * Edit User data
   * @param {userId} payload
   * @param {UpdateUserDto} payload
   * @returns {Promise<IUser>} mutated User data
   */
  async updateUser(
    userId: string,
    payload: UpdateUserDto,
  ): Promise<WithId<User>> {
    const data = await this.userRepository.updateUser(userId, payload);
    return data;
  }

  /**
   * Delete user given a email
   * @param {userId} param
   * @returns {Promise<IGenericMessageBody>}
   */
  async deleteUser(userId: string) {
    const data: any = await this.userRepository.deleteUser(userId);
    return data;
  }
  async sendVerificationEmail(
    resetPasswordDto: ResetPasswordPayload,
  ): Promise<void> {
    const userDetails = await this.getUserByEmail(resetPasswordDto.email);
    if (!userDetails) {
      throw new UnauthorizedException(ErrorMessages.BadRequestError);
    }
    const transporter = nodemailer.createTransport({
      service: EmailServiceProvider.GMAIL,
      auth: {
        user: this.configService.get("app.senderEmail"),
        pass: this.configService.get("app.senderPassword"),
      },
    });
    const verificationCode = this.generateEmailVerificationCode();
    const handlebarOptions = {
      //view engine contains default and partial templates
      viewEngine: {
        defaultLayout: "",
      },
      viewPath: path.resolve(__dirname, "..", "..", "views"),
    };
    transporter.use("compile", hbs(handlebarOptions));
    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: resetPasswordDto.email,
      text: "Sparrow Password Reset",
      template: "verifyEmail",
      context: {
        name: userDetails.name,
        verificationCode,
      },
      subject: `Reset Your Sparrow Account Password`,
    };
    const promise = [
      transporter.sendMail(mailOptions),
      this.userRepository.updateVerificationCode(
        resetPasswordDto.email,
        verificationCode,
      ),
    ];
    await Promise.all(promise);
  }

  async sendWelcomeEmail(earlyAccessDto: EarlyAccessPayload): Promise<void> {
    const transporter = nodemailer.createTransport({
      service: EmailServiceProvider.GMAIL,
      auth: {
        user: this.configService.get("app.email"),
        pass: this.configService.get("app.password"),
      },
    });
    const handlebarOptions = {
      viewEngine: {
        defaultLayout: "",
      },
      viewPath: path.resolve(__dirname, "..", "..", "views"),
    };
    transporter.use("compile", hbs(handlebarOptions));

    const mailOptions = {
      from: this.configService.get("app.email"),
      to: earlyAccessDto.email,
      subject: `Welcome to Sparrow `,
      template: "welcomeEmail",
    };
    const promise = [
      transporter.sendMail(mailOptions),
      this.userRepository.saveEarlyAccessEmail(earlyAccessDto.email),
    ];
    await Promise.all(promise);
  }
  async logoutUser(userId: string, refreshToken: string): Promise<void> {
    const user = await this.userRepository.findUserByUserId(
      new ObjectId(userId),
    );
    const hashrefreshToken = user.refresh_tokens.filter((token) => {
      if (createHmac("sha256", refreshToken).digest("hex") === token) {
        return token;
      }
    });
    if (!hashrefreshToken) {
      throw new BadRequestException();
    }
    await this.userRepository.deleteRefreshToken(userId, hashrefreshToken[0]);
    return;
  }
  async createGoogleAuthUser(
    oauthId: string,
    name: string,
    email: string,
  ): Promise<InsertOneResult> {
    const user = await this.userRepository.createGoogleAuthUser(
      oauthId,
      name,
      email,
    );
    const workspaceObj = {
      name: this.configService.get("app.defaultWorkspaceName"),
      type: WorkspaceType.PERSONAL,
    };
    await this.producerService.produce(TOPIC.CREATE_USER_TOPIC, {
      value: JSON.stringify(workspaceObj),
    });
    return user;
  }

  async verifyVerificationCode(
    email: string,
    verificationCode: string,
  ): Promise<void> {
    const user = await this.getUserByEmail(email);
    if (user.verificationCode !== verificationCode) {
      throw new UnauthorizedException(ErrorMessages.Unauthorized);
    }
    const expireTime = this.configService.get(
      "app.emailValidationCodeExpirationTime",
    );
    if (
      (Date.now() - user.verificationCodeTimeStamp.getTime()) / 1000 >
      expireTime
    ) {
      throw new UnauthorizedException(ErrorMessages.VerificationCodeExpired);
    }
    return;
  }
  async updatePassword(email: string, password: string): Promise<void> {
    const user = await this.getUserByEmailAndPass(email, password);

    if (user) {
      throw new UnauthorizedException(ErrorMessages.PasswordExist);
    }
    await this.userRepository.updatePassword(email, password);
    return;
  }
  generateEmailVerificationCode(): string {
    return (Math.random() + 1).toString(36).substring(2, 8);
  }
}
