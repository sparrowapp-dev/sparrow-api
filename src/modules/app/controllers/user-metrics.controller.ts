import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from "@nestjs/swagger";
import { UserMetricsService, UserMetricsData, UserRequestData } from "../services/user-metrics.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserMetricsSummaryDto, UserRequestStatsDto, TopUsersQueryDto } from "../dto/user-metrics.dto";

@ApiTags("User Metrics")
@Controller("user-metrics")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserMetricsController {
  constructor(private readonly userMetricsService: UserMetricsService) {}

  @Get("summary")
  @Roles("admin")
  @ApiOperation({
    summary: "Get user metrics summary",
    description: "Returns total unique users, active users, and environment information",
  })
  @ApiResponse({
    status: 200,
    description: "User metrics summary retrieved successfully",
    type: UserMetricsSummaryDto,
  })
  async getUserMetricsSummary(): Promise<UserMetricsData> {
    return this.userMetricsService.getUserMetricsSummary();
  }

  @Get("user-requests")
  @Roles("admin")
  @ApiOperation({
    summary: "Get user request statistics",
    description: "Returns request statistics for all users",
  })
  @ApiResponse({
    status: 200,
    description: "User request statistics retrieved successfully",
    type: [UserRequestStatsDto],
  })
  async getUserRequestStats(): Promise<UserRequestData[]> {
    return this.userMetricsService.getUserRequestStats();
  }

  @Get("top-users")
  @Roles("admin")
  @ApiOperation({
    summary: "Get top active users",
    description: "Returns the most active users by request count",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of top users to return (default: 10)",
  })
  @ApiResponse({
    status: 200,
    description: "Top active users retrieved successfully",
    type: [UserRequestStatsDto],
  })
  async getTopActiveUsers(@Query("limit") limit?: number): Promise<UserRequestData[]> {
    const userLimit = limit && limit > 0 ? Math.min(limit, 100) : 10; // Cap at 100
    return this.userMetricsService.getTopActiveUsers(userLimit);
  }
}
