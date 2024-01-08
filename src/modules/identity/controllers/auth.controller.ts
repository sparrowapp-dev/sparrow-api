import {
  Controller,
  Body,
  Post,
  UseGuards,
  Get,
  Req,
  Res,
} from "@nestjs/common";
import { ContextService } from "@src/modules/common/services/context.service";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthService } from "../services/auth.service";
import { LoginPayload } from "../payloads/login.payload";
import { FastifyReply, FastifyRequest } from "fastify";
import { RefreshTokenGuard } from "@src/modules/common/guards/refresh-token.guard";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { GoogleOAuthGuard } from "@src/modules/common/guards/google-oauth.guard";
import { UserService } from "../services/user.service";
import { ObjectId } from "mongodb";
import { ConfigService } from "@nestjs/config";
/**
 * Authentication Controller
 */
export interface RefreshTokenRequest extends FastifyRequest {
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
    private readonly contextService: ContextService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
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

    await this.authService.checkRefreshTokenSize(user);

    const tokenPromises = [
      this.authService.createToken(user._id),
      this.authService.createRefreshToken(user._id),
    ];
    const [accessToken, refreshToken] = await Promise.all(tokenPromises);

    const data = {
      accessToken,
      refreshToken,
    };
    const responseData = new ApiResponseService(
      "Login Successfull",
      HttpStatusCode.OK,
      data,
    );
    res.status(responseData.httpStatusCode).send(responseData);
    return data;
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
    res.status(responseData.httpStatusCode).send(responseData);
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
    const { oAuthId, name, email } = req.user;
    const isUserExists = await this.userService.getUserByEmail(email);
    let id: ObjectId;
    if (isUserExists) {
      id = isUserExists._id;
      this.contextService.set("user", isUserExists);
      await this.authService.checkRefreshTokenSize(isUserExists);
    } else {
      const user = await this.userService.createGoogleAuthUser(
        oAuthId,
        name,
        email,
      );
      this.contextService.set("user", { id: user.insertedId, name, email });
      id = user.insertedId;
    }
    const tokenPromises = [
      this.authService.createToken(id),
      this.authService.createRefreshToken(id),
    ];
    const [accessToken, refreshToken] = await Promise.all(tokenPromises);

    const url = encodeURI(this.configService.get("oauth.google.redirectUrl"));
    res.redirect(
      HttpStatusCode.MOVED_PERMANENTLY,
      `${url}?accessToken=${accessToken.token}&refreshToken=${refreshToken.token}`,
    );
  }
}
