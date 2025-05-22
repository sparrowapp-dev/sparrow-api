import {
  Controller,
  Get,
  Res,
  Query,
  BadRequestException,
  Post,
  Body,
  UnauthorizedException,
} from "@nestjs/common";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AdminAuthService } from "../services/user-admin.auth.service";

/**
 * Interface for refresh token request
 */
export interface RefreshTokenRequest {
  user: {
    _id: string;
    refreshToken: string;
  };
}

@Controller("api/admin/auth")
@ApiTags("admin authentication")
export class AdminAuthController {
  private readonly OAUTH_SIGNUP_DELAY_MS = 5000;

  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Get("callback")
  @ApiOperation({ summary: "Handle admin login callback" })
  @ApiQuery({ name: "token", required: true, type: String })
  @ApiResponse({ status: 200, description: "Admin login successful" })
  @ApiResponse({ status: 400, description: "Token query param is required" })
  async handleAdminLogin(
    @Query("token") shortLivedToken: string,
    @Res() res: FastifyReply,
  ) {
    if (!shortLivedToken) {
      throw new BadRequestException("Token query param is required");
    }

    // Validate the short-lived token
    const tokens =
      await this.adminAuthService.validateShortLivedToken(shortLivedToken);

    const responseData = new ApiResponseService(
      "Admin login successful",
      HttpStatusCode.OK,
      tokens,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("refresh-token")
  @ApiOperation({
    summary: "Refresh access token",
    description: "Generate a new access token using a valid refresh token",
  })
  @ApiResponse({ status: 200, description: "Token refreshed successfully" })
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token" })
  async refreshToken(
    @Body() refreshTokenDto: { refreshToken: string },
    @Res() res: FastifyReply,
  ) {
    try {
      if (!refreshTokenDto.refreshToken) {
        throw new BadRequestException("Refresh token is required");
      }

      const tokens = await this.adminAuthService.refreshAccessToken(
        refreshTokenDto.refreshToken,
      );

      const responseData = new ApiResponseService(
        "Token refreshed successfully",
        HttpStatusCode.OK,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    } catch (error) {
      const statusCode =
        error instanceof UnauthorizedException
          ? HttpStatusCode.UNAUTHORIZED
          : HttpStatusCode.BAD_REQUEST;

      const responseData = new ApiResponseService(
        error.message || "Token refresh failed",
        statusCode,
        null,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    }
  }
}
