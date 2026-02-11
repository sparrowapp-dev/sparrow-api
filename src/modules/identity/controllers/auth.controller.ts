import {
  Controller,
  Body,
  Post,
  UseGuards,
  Get,
  Req,
  Res,
  BadRequestException,
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
import { TeamUserService } from "../services/team-user.service";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { ExtendedFastifyRequest } from "@src/types/fastify";
import { TeamService } from "../services/team.service";
import { JwtService } from "@nestjs/jwt";
import { ForbiddenException } from "@nestjs/common/exceptions/forbidden.exception";
import { TeamRepository } from "../repositories/team.repository";
import { NotFoundException } from "@nestjs/common/exceptions/not-found.exception";
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
    private readonly teamUserService: TeamUserService,
    private readonly configService: ConfigService,
    private readonly hubspotService: HubSpotService,
    private readonly teamService: TeamService,
    private readonly jwtService: JwtService,
    private readonly teamRepository: TeamRepository,
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

  @Post("invite/accept-and-login")
  @ApiOperation({
    summary: "Accept invite and login user",
  })
  async acceptInviteAndLogin(
    @Body() body: { teamId: string; inviteId: string; email: string },
    @Res() res: FastifyReply,
  ) {
    const { teamId, inviteId, email } = body;

    const inviteResult = await this.teamUserService.acceptInviteByEmail(
      inviteId,
      teamId,
      email,
    );

    const user = await this.userService.getUserByEmail(email);
    if (!user) {
      throw new BadRequestException("User not found after invite acceptance");
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.authService.createToken(user._id),
      this.authService.createRefreshToken(user._id),
    ]);

    return res.status(HttpStatusCode.OK).send(
      new ApiResponseService(
        "Invite accepted & login successful",
        HttpStatusCode.OK,
        {
          accessToken,
          refreshToken,
          teamId,
          teamName: inviteResult.teamName,
          workspaces: inviteResult.workspaces,
          role: inviteResult.role,
        },
      ),
    );
  }

  @Post("admin-sso-token")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Generate Admin SSO Token (Owner/Admin only)" })
  async generateAdminSsoToken(
    @Body() body: { teamId: string },
    @Req() req: ExtendedFastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const { teamId } = body;

    if (!teamId) {
      throw new BadRequestException("Team ID is required");
    }

    const user = req.user;

    // Allow ANY team member (owner, admin, member)

    const team = await this.teamRepository.findTeamByTeamId(
      new ObjectId(teamId),
    );

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    const isMember = team.users.some(
      (member) => member.id.toString() === user._id.toString(),
    );

    if (!isMember) {
      throw new ForbiddenException("You are not a member of this team");
    }

    const ssoToken = this.jwtService.sign(
      {
        _id: user._id,
        email: user.email,
        name: user.name,
        type: "admin-sso",
      },
      {
        secret: this.configService.get("app.jwtSecretKey"),
        expiresIn: "5m",
      },
    );

    return res.status(200).send({
      message: "Admin SSO token generated successfully",
      ssoToken,
    });
  }
}
