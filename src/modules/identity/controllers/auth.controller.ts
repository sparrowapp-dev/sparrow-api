import {
  Controller,
  Body,
  Post,
  UseGuards,
  Get,
  Req,
  Res,
} from "@nestjs/common";

import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthService } from "../services/auth.service";
import { LoginPayload } from "../payloads/login.payload";
import { FastifyReply } from "fastify";
import { RefreshTokenGuard } from "@src/modules/common/guards/refresh-token.guard";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { GoogleOAuthGuard } from "@src/modules/common/guards/google-oauth.guard";
import { UserService } from "../services/user.service";
import { ObjectId } from "mongodb";
import { ConfigService } from "@nestjs/config";
import { HubSpotService } from "../services/hubspot.service";
/**
 * Authentication Controller
 */
export interface RefreshTokenRequest {
  user: {
    _id: string;
    refreshToken: string;
  };
}
@Controller("api/auth")
@ApiTags("authentication")
export class AuthController {
  private readonly OAUTH_SIGNUP_DELAY_MS = 5000;
  /**
   * Constructor
   * @param {AuthService} authService authentication service
   */
  constructor(
    private readonly authService: AuthService,

    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly hubspotService: HubSpotService,
  ) {}

  /**
   * Login route to validate and create tokens for users
   * @param {LoginPayload} payload the login dto
   */
  @Post("login")
  @ApiOperation({
    summary: "User Login",
    description: "Authenticate a User with their Credentials",
  })
  @ApiResponse({ status: 201, description: "Login Completed" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async login(@Body() payload: LoginPayload, @Res() res: FastifyReply) {
    const user = await this.authService.validateUser(payload);
    // Removing refresh token limit check until refresh token flow is fixed - Nayan (Feb 28, 2024)
    // await this.authService.checkRefreshTokenLimit(user);
    let userAccessToken;
    let userRefreshToken;
    if (user?.isEmailVerified) {
      const tokenPromises = [
        this.authService.createToken(user._id),
        this.authService.createRefreshToken(user._id),
      ];
      const [accessToken, refreshToken] = await Promise.all(tokenPromises);
      userAccessToken = accessToken;
      userRefreshToken = refreshToken;
    } else {
      await this.userService.sendUserVerificationEmail({
        email: payload.email,
      });
    }

    const data = {
      accessToken: userAccessToken,
      refreshToken: userRefreshToken,
      isEmailVerified: user?.isEmailVerified ? true : false,
    };
    const responseData = new ApiResponseService(
      "Login Successful",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("/refresh-token")
  @ApiOperation({
    summary: "Generate a new AccessToken with RefreshToken",
    description:
      "This will help us to Generate a new AccessToken and RefreshToken once AccessToken expires.(Send AccessToken)",
  })
  @UseGuards(RefreshTokenGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 201, description: "Access Token Generated" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async refreshToken(
    @Req() request: RefreshTokenRequest,
    @Res() res: FastifyReply,
  ) {
    const userId = request.user._id;
    const refreshToken = request.user.refreshToken;
    const data = await this.authService.validateRefreshToken(
      userId,
      refreshToken,
    );
    const responseData = new ApiResponseService(
      "Token Generated",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  //initializes Google authentication
  @Get("google")
  @ApiOperation({
    summary: "Intializes Google Authentication",
    description: "This will help us to authenticate user with  google",
  })
  @UseGuards(GoogleOAuthGuard)
  async googlelogin() {}

  //google calls this after authentication
  @Get("google/callback")
  @ApiOperation({
    summary: "Google Callback",
    description:
      "This will help us to get User Details to create User after Google Authenciation",
  })
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(@Req() req: any, @Res() res: FastifyReply) {
    if (req.user === "access_denied") {
      const url = encodeURI(this.configService.get("oauth.google.redirectUrl"));
      const urlWithToken = `${url}?accessToken=&refreshToken=`;
      const urlWithTokenAndSource = urlWithToken + "&source=";

      return res.redirect(
        HttpStatusCode.MOVED_PERMANENTLY,
        urlWithTokenAndSource,
      );
    }

    const { oAuthId, name, email } = req.user;
    const isUserExists = await this.userService.getUserByEmail(email);
    let id: ObjectId;
    if (isUserExists) {
      id = isUserExists._id;
      // Removing refresh token limit check until refresh token flow is fixed - Nayan (Feb 28, 2024)
      // await this.authService.checkRefreshTokenLimit(isUserExists);
    } else {
      const user = await this.userService.createGoogleAuthUser(
        oAuthId,
        name,
        email,
      );
      id = user.insertedId;
      if (this.configService.get("hubspot.hubspotEnabled") === "true") {
        await this.hubspotService.createContact(email, name);
      }
    }
    const tokenPromises = [
      this.authService.createToken(id),
      this.authService.createRefreshToken(id),
    ];
    const [accessToken, refreshToken] = await Promise.all(tokenPromises);

    const url = encodeURI(this.configService.get("oauth.google.redirectUrl"));
    const urlWithToken = `${url}?accessToken=${accessToken.token}&refreshToken=${refreshToken.token}`;
    let urlWithTokenAndSource = urlWithToken + "&source=";
    if (isUserExists) {
      urlWithTokenAndSource = urlWithTokenAndSource + "login";
    } else {
      urlWithTokenAndSource = urlWithTokenAndSource + "register";
    }
    return res.redirect(
      HttpStatusCode.MOVED_PERMANENTLY,
      urlWithTokenAndSource,
    );
  }
}
