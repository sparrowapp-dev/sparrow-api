import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { UserMetricsService } from "../services/user-metrics.service";

/**
 * Controller for user metrics endpoints
 */
@ApiTags("user-metrics")
@ApiBearerAuth()
@Controller("api/user-metrics")
export class UserMetricsController {
  constructor(private readonly userMetricsService: UserMetricsService) {}

  /**
   * Get comprehensive user statistics (admin only)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("statistics")
  @ApiOperation({
    summary: "Get user statistics",
    description:
      "Returns comprehensive user metrics including unique users, active users, and request statistics",
  })
  @ApiResponse({
    status: 200,
    description: "User statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        httpStatusCode: { type: "number" },
        data: {
          type: "object",
          properties: {
            uniqueUsers: { type: "number", description: "Total unique users" },
            activeUsers24h: {
              type: "number",
              description: "Active users in last 24 hours",
            },
            activeUsers7d: {
              type: "number",
              description: "Active users in last 7 days",
            },
            activeUsers30d: {
              type: "number",
              description: "Active users in last 30 days",
            },
            totalRequests: {
              type: "number",
              description: "Total requests made by all users",
            },
            averageRequestsPerUser: {
              type: "number",
              description: "Average requests per user",
            },
          },
        },
      },
    },
  })
  async getUserStatistics(@Res() res: FastifyReply) {
    try {
      const statistics = await this.userMetricsService.getUserStatistics();

      const responseData = new ApiResponseService(
        "User statistics retrieved successfully",
        HttpStatusCode.OK,
        statistics,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    } catch (error) {
      const responseData = new ApiResponseService(
        "Failed to retrieve user statistics",
        HttpStatusCode.INTERNAL_SERVER_ERROR,
        null,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    }
  }

  /**
   * Get unique user count (admin only)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("unique-users")
  @ApiOperation({
    summary: "Get unique user count",
    description:
      "Returns the total number of unique users that have accessed the system",
  })
  @ApiResponse({
    status: 200,
    description: "Unique user count retrieved successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        httpStatusCode: { type: "number" },
        data: {
          type: "object",
          properties: {
            uniqueUsers: { type: "number" },
          },
        },
      },
    },
  })
  async getUniqueUserCount(@Res() res: FastifyReply) {
    try {
      const uniqueUsers = await this.userMetricsService.getUniqueUserCount();

      const responseData = new ApiResponseService(
        "Unique user count retrieved successfully",
        HttpStatusCode.OK,
        { uniqueUsers },
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    } catch (error) {
      const responseData = new ApiResponseService(
        "Failed to retrieve unique user count",
        HttpStatusCode.INTERNAL_SERVER_ERROR,
        null,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    }
  }

  /**
   * Trigger manual metrics update (admin only)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("refresh")
  @ApiOperation({
    summary: "Refresh user metrics",
    description: "Manually trigger an update of all user metrics",
  })
  @ApiResponse({
    status: 200,
    description: "Metrics refreshed successfully",
  })
  async refreshMetrics(@Res() res: FastifyReply) {
    try {
      await this.userMetricsService.updateMetrics();

      const responseData = new ApiResponseService(
        "User metrics refreshed successfully",
        HttpStatusCode.OK,
        null,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    } catch (error) {
      const responseData = new ApiResponseService(
        "Failed to refresh user metrics",
        HttpStatusCode.INTERNAL_SERVER_ERROR,
        null,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    }
  }
}
