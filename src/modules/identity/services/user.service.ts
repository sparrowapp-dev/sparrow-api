import { BadRequestException, Injectable } from "@nestjs/common";
import {
  EmailPayload,
  RegisteredWith,
  UpdateUserDto,
} from "../payloads/user.payload";
import { UserRepository } from "../repositories/user.repository";
import { RegisterPayload } from "../payloads/register.payload";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { User } from "@src/modules/common/models/user.model";
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
import { TeamService } from "./team.service";

import { EmailService } from "@src/modules/common/services/email.service";
import { VerificationPayload } from "../payloads/verification.payload";
import { HubSpotService } from "./hubspot.service";
import { DecodedUserObject } from "@src/types/fastify";
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
    private readonly teamService: TeamService,
    private readonly emailService: EmailService,
    private readonly hubspotService: HubSpotService,
  ) {}

  /**
   * Fetches a user from database by UUID
   * @param {string} id
   * @returns {Promise<IUser>} queried user data
   */
  async getUserById(
    id: string,
    user?: DecodedUserObject,
  ): Promise<DecodedUserObject> {
    const data = await this.userRepository.getUserById(id, user);
    return data;
  }

  /**
   * Fetches a user from database by username
   * @param {string} email
   * @returns {Promise<IUser>} queried user data
   */
  async getUserByEmail(email: string): Promise<WithId<User>> {
    return await this.userRepository.getUserByEmail(email.toLowerCase());
  }

  /**
   * Fetches a user from database by username
   * @param {string} email
   * @returns {Promise<IUser>} queried user data
   */
  async getUserRegisterStatus(email: string): Promise<RegisteredWith> {
    const user = await this.userRepository.getUserByEmail(email);
    if (user?.authProviders) {
      // Registered with google auth
      return {
        registeredWith: "google",
      };
    } else if (user?.email) {
      // registered with email
      return {
        registeredWith: "email",
      };
    } else {
      return {
        registeredWith: "unknown",
      };
    }
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
    payload.email = payload.email.toLowerCase();
    const userExist = await this.getUserByEmail(payload.email);
    if (userExist) {
      throw new BadRequestException(
        "The account with the provided email currently exists. Please choose another one.",
      );
    }
    const user = await this.userRepository.createUser(payload);

    const userData = {
      _id: user.insertedId,
      name: payload.name,
      email: payload.email,
      role: "",
    };

    const data = {
      isUserCreated: true,
      isEmailVerified: false,
    };
    const firstName = await this.getFirstName(payload.name);
    const teamName = {
      name: firstName + this.configService.get("app.defaultTeamNameSuffix"),
      firstTeam: true,
    };
    await this.teamService.create(teamName, userData);
    // Disabling the welcome email due to hubspot integration
    // await this.sendSignUpEmail(firstName, payload.email);
    await this.sendUserVerificationEmail({ email: payload.email });
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
    payload: Partial<UpdateUserDto>,
    currentUser: DecodedUserObject,
  ): Promise<DecodedUserObject> {
    const data = await this.userRepository.updateUser(
      userId,
      payload,
      currentUser,
    );
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
    const userDetails = await this.getUserByEmail(
      resetPasswordDto.email.toLowerCase(),
    );
    if (!userDetails) {
      throw new BadRequestException(ErrorMessages.BadRequestError);
    }
    const transporter = this.emailService.createTransporter();

    const verificationCode = this.generateEmailVerificationCode().toUpperCase();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: resetPasswordDto.email,
      text: "Sparrow Password Reset",
      template: "verifyEmail",
      context: {
        name: userDetails.name.split(" ")[0],
        verificationCode,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Reset your Sparrow account password`,
    };
    const promise = [
      this.emailService.sendEmail(transporter, mailOptions),
      this.userRepository.updateVerificationCode(
        resetPasswordDto.email.toLowerCase(),
        verificationCode,
      ),
    ];
    await Promise.all(promise);
  }

  /**
   * Sends a verification email to the user if their email is not already verified.
   * The email includes a verification code and other necessary information.
   * Also updates the user's verification code in the database.
   *
   * @param verificationPayload - The payload containing the user's email for verification.
   * @throws If the email is already verified.
   * @returns Resolves when the email is sent and the verification code is updated.
   */
  async sendUserVerificationEmail(
    verificationPayload: VerificationPayload,
  ): Promise<void> {
    const userDetails = await this.getUserByEmail(
      verificationPayload.email.toLowerCase(),
    );
    if (userDetails?.isEmailVerified) {
      throw new BadRequestException("Email Already Verified");
    }
    // Create an email transporter using the email service
    const transporter = this.emailService.createTransporter();

    const verificationCode = this.generateEmailVerificationCode().toUpperCase();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: verificationPayload.email,
      text: "Email Verification Code",
      template: "signUpVerifyEmail",
      context: {
        name: userDetails.name.split(" ")[0],
        verificationCode,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Your Sparrow Verification Code Inside - Let’s Get You Started!`,
    };
    const promise = [
      this.emailService.sendEmail(transporter, mailOptions),
      this.userRepository.updateEmailVerificationCode(
        verificationPayload.email.toLowerCase(),
        verificationCode,
      ),
    ];
    await Promise.all(promise);
  }

  parseEmailList(str: string) {
    // Replace single quotes with double quotes to make it valid JSON
    const jsonCompatible = str.replace(/'/g, '"');

    try {
      const emailArray = JSON.parse(jsonCompatible);
      if (Array.isArray(emailArray)) {
        return emailArray;
      }
    } catch (err) {
      console.log("Failed to parse email list:", err);
      return [];
    }
  }

  /**
   * Sends a email to the user with the magic code to login.
   * The email includes a magic code and other necessary information.
   * Also updates the user's magic code in the database.
   *
   * @param emailPayload - The payload containing the user's email for magic code.
   * @throws If the email is already verified.
   * @returns Resolves when the email is sent and the verification code is updated and return the user data.
   */
  async sendMagicCodeEmail(emailPayload: EmailPayload): Promise<WithId<User>> {
    const userDetails = await this.getUserByEmail(
      emailPayload.email.toLowerCase(),
    );
    if (
      userDetails &&
      userDetails?.magicCodeTimeStamp &&
      userDetails?.secondLastMagicCodeTimeStamp &&
      (new Date(userDetails.magicCodeTimeStamp).getTime() -
        new Date(userDetails.secondLastMagicCodeTimeStamp).getTime()) /
        60000 <
        30 && // Difference between magicCodeTimestamp and secondLastMagicCodeTimestamp < 30 mins
      userDetails?.magicCodeTimeStamp &&
      (Date.now() - new Date(userDetails.magicCodeTimeStamp).getTime()) /
        60000 <
        30 // Difference between magicCodeTimestamp and current time < 30 mins
    ) {
      throw new BadRequestException("Cooldown Active");
    }
    // Create an email transporter using the email service
    const transporter = this.emailService.createTransporter();
    const whitelistEmails = await this.configService.get(
      "testing.whitelistEmail",
    );
    let parsedWhiteListEmails: string[] = [];
    if (whitelistEmails) {
      parsedWhiteListEmails = this.parseEmailList(whitelistEmails) || [];
    }

    let magicCode;
    if (parsedWhiteListEmails.includes(emailPayload.email)) {
      magicCode = "000000";
    } else {
      magicCode = this.generateEmailVerificationCode().toUpperCase();
    }

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: emailPayload.email,
      text: "Magic Code",
      template: "magicCodeEmail",
      context: {
        name: userDetails.name.split(" ")[0],
        magicCode,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Your Sparrow's Magic Code is Inside!`,
    };
    const promise = [
      this.emailService.sendEmail(transporter, mailOptions),
      this.userRepository.updateMagicCode(
        emailPayload.email.toLowerCase(),
        magicCode,
        userDetails?.magicCodeTimeStamp,
        userDetails.lastMagicCodeTimeStamp,
      ),
    ];
    await Promise.all(promise);
    return userDetails;
  }

  async sendWelcomeEmail(earlyAccessDto: EarlyAccessPayload): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.configService.get("app.mailHost"),
      port: this.configService.get("app.mailPort"),
      secure: this.configService.get("app.mailSecure") === "true",
      auth: {
        user: this.configService.get("app.userName"),
        pass: this.configService.get("app.senderPassword"),
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
      from: this.configService.get("app.senderEmail"),
      to: earlyAccessDto.email,
      subject: `Welcome to Sparrow `,
      template: "welcomeEmail",
    };
    const promise = [
      this.emailService.sendEmail(transporter, mailOptions),
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
    const createdUser = await this.userRepository.createGoogleAuthUser(
      oauthId,
      name,
      email,
    );
    const user = {
      _id: createdUser.insertedId,
      name: name,
      email: email,
      role: "",
      teams: [] as any[],
      workspaces: [] as any[],
    };
    const firstName = await this.getFirstName(name);
    const teamName = {
      name: firstName + this.configService.get("app.defaultTeamNameSuffix"),
      firstTeam: true,
    };
    await this.teamService.create(teamName, user);
    return createdUser;
  }

  async verifyVerificationCode(
    email: string,
    verificationCode: string,
    expireTime: number,
  ): Promise<void> {
    const user = await this.getUserByEmail(email);
    if (!user?.isVerificationCodeActive) {
      throw new BadRequestException(ErrorMessages.Unauthorized);
    }
    if (user?.verificationCode !== verificationCode) {
      throw new BadRequestException(ErrorMessages.Unauthorized);
    }
    if (
      (Date.now() - user.verificationCodeTimeStamp.getTime()) / 1000 >
      expireTime
    ) {
      throw new BadRequestException(ErrorMessages.VerificationCodeExpired);
    }
    return;
  }

  /**
   * Verifies the user's email verification code and updates the user's email verification status.
   * If the code is valid and not expired, generates and returns access and refresh tokens.
   *
   * @param email - The email address of the user who is verifying the code.
   * @param verificationCode - The verification code sent to the user.
   * @param expireTime - The time (in seconds) after which the verification code expires.
   * @throws  If the verification code is wrong or expired.
   * @returns  An object containing the access and refresh tokens.
   */
  async verifyUserEmailVerificationCode(
    email: string,
    verificationCode: string,
    expireTime: number,
  ) {
    const user = await this.getUserByEmail(email);
    if (user?.emailVerificationCode !== verificationCode) {
      throw new BadRequestException("Wrong Code");
    }
    if (user?.isEmailVerified) {
      throw new BadRequestException("Email Already Verified");
    }
    if (
      (Date.now() - user.emailVerificationCodeTimeStamp.getTime()) / 1000 >
      expireTime
    ) {
      throw new BadRequestException(ErrorMessages.VerificationCodeExpired);
    }
    if (verificationCode === user.emailVerificationCode) {
      await this.userRepository.updateUserEmailVerificationStatus(email);
    }
    const tokenPromises = [
      this.authService.createToken(user._id),
      this.authService.createRefreshToken(user._id),
    ];
    const [accessToken, refreshToken] = await Promise.all(tokenPromises);
    const data = {
      accessToken,
      refreshToken,
    };
    if (this.configService.get("hubspot.hubspotEnabled") === "true") {
      await this.hubspotService.createContact(user.email, user.name);
    }
    return data;
  }

  async expireVerificationCode(email: string): Promise<void> {
    await this.userRepository.expireVerificationCode(email);
    return;
  }

  async refreshVerificationCode(email: string): Promise<string> {
    const verificationCode = this.generateEmailVerificationCode().toUpperCase();
    await this.userRepository.updateVerificationCode(email, verificationCode);
    return verificationCode;
  }

  async updatePassword(email: string, password: string): Promise<void> {
    const user = await this.getUserByEmailAndPass(email, password);

    if (user) {
      throw new BadRequestException(ErrorMessages.PasswordExist);
    }
    await this.userRepository.updatePassword(email, password);
    await this.expireVerificationCode(email);
    return;
  }

  generateEmailVerificationCode(): string {
    return (Math.random() + 1).toString(36).substring(2, 8);
  }

  async getFirstName(name: string): Promise<string> {
    const nameArray = name.split(" ");
    return nameArray[0];
  }

  async sendSignUpEmail(firstname: string, email: string): Promise<void> {
    const transporter = this.emailService.createTransporter();
    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: email,
      text: "Sparrow Welcome",
      template: "signUpEmail",
      context: {
        name: firstname,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Welcome to Sparrow - Elevate Your REST API Management Effortlessly!`,
    };
    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }

  /**
   * Verifies the user's magic code and updates the user's email magic code status.
   * If the code is valid and not expired, generates and returns access and refresh tokens.
   *
   * @param email - The email address of the user who is verifying the code.
   * @param magicCode - The magic code sent to the user.
   * @param expireTime - The time (in seconds) after which the verification code expires.
   * @throws  If the verification code is wrong or expired.
   * @returns  An object containing the access and refresh tokens.
   */
  async verifyMagicCode(email: string, magicCode: string, expireTime: number) {
    const user = await this.getUserByEmail(email);
    if (user?.magicCode !== magicCode) {
      throw new BadRequestException("Wrong Code");
    }
    if ((Date.now() - user.magicCodeTimeStamp.getTime()) / 1000 > expireTime) {
      throw new BadRequestException(ErrorMessages.MagicCodeExpired);
    }
    if (magicCode === user.magicCode) {
      await this.userRepository.updateUserMagicCodeStatus(email);
    }
    const tokenPromises = [
      this.authService.createToken(user._id),
      this.authService.createRefreshToken(user._id),
    ];
    const [accessToken, refreshToken] = await Promise.all(tokenPromises);
    const data = {
      accessToken,
      refreshToken,
      isEmailVerified: true,
    };
    return data;
  }

  /**
   * Updates the user's occasional updates subscription status.
   *
   * @param email - The email address of the user whose Magic Code is being updated.
   * @param isUserAcceptedOccasionalUpdates - Boolean value wheather user accepted or not.
   * @returns A promise that resolves when the update operation is complete.
   */
  async updateUserOccaisonalUpdates(
    email: string,
    isUserAcceptedOccasionalUpdates: boolean,
  ): Promise<WithId<User>> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new BadRequestException("User does not exist");
    }
    const data = await this.userRepository.updateOccaisonalUpdates(
      email,
      isUserAcceptedOccasionalUpdates,
    );
    return data.value;
  }
  async updateLastActive(userId: string) {
    await this.userRepository.updateLastActiveQuietly(userId);
  }
}
