import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AdminUsersService } from "../services/user-admin.enterprise-user.service";

@Controller("api/admin")
@ApiTags("admin users")
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("enterpriseUsers")
  @ApiOperation({
    summary: "Get all the users in hub in which the logged in user is owner",
  })
  async getUsers(@Req() req: any, @Res() res: FastifyReply) {
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID is missing from token");
    }
    const data = await this.usersService.getAllUsers(userId);
    const responseData = new ApiResponseService(
      "Users Generated",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("enterpriseUsers-details")
  @ApiOperation({
    summary: "Get user details for the enterprise logged in user is owner",
  })
  async getUsersDetails(
    @Req() req: any,
    @Query("userId") userId: string,
    @Res() res: FastifyReply,
  ) {
    const ownerId = req.user._id;

    if (!ownerId) {
      throw new UnauthorizedException("User ID is missing from token");
    }
    const data = await this.usersService.getUserDetails(ownerId, userId);
    const responseData = new ApiResponseService(
      "Users Details Generated",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("dashboard-stats")
  @ApiOperation({
    summary: "Get dashboard statistics (total users, new invites, total hubs)",
    description: "Returns counts and month-over-month changes for key metrics",
  })
  async getDashboardStats(@Req() req: any, @Res() res: FastifyReply) {
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID is missing from token");
    }

    const stats = await this.usersService.getDashboardStats(userId);

    const responseData = new ApiResponseService(
      "Dashboard statistics generated",
      HttpStatusCode.OK,
      stats,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("user-activity")
  @ApiOperation({
    summary: "Get activity for all users in admin's teams",
    description:
      "Returns paginated list of user activities (updates) across all workspaces in admin's teams",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 20)",
  })
  @ApiResponse({
    status: 200,
    description: "User activities retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getUserActivity(
    @Req() req: any,
    @Res() res: FastifyReply,
    @Query("page") pageString: string = "1",
    @Query("limit") limitString: string = "20",
  ) {
    const userId = req.user._id;
    if (!userId) {
      throw new UnauthorizedException("User ID is missing from token");
    }

    // Convert string parameters to numbers
    const page = parseInt(pageString, 10) || 1;
    const limit = parseInt(limitString, 10) || 20;

    const activities = await this.usersService.getUserActivities(
      userId.toString(),
      page,
      limit,
    );

    const responseData = new ApiResponseService(
      "User activities retrieved successfully",
      HttpStatusCode.OK,
      activities,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("user-distribution")
  @ApiOperation({
    summary: "Get user role distribution for pie chart",
    description:
      "Returns user distribution data by role (admin vs member) for visualization",
  })
  @ApiResponse({
    status: 200,
    description: "User distribution generated successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "No teams found for user" })
  async getUserDistribution(@Req() req: any, @Res() res: FastifyReply) {
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID missing from token");
    }

    const data = await this.usersService.getUserDistribution(userId);

    const responseData = new ApiResponseService(
      "User distribution data generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("user-trends")
  @ApiOperation({
    summary: "Get user role trends for line graph",
    description:
      "Returns user count trends by role (admin vs member) over time",
  })
  @ApiResponse({
    status: 200,
    description: "User trend data generated successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "No teams found for user" })
  async getUserTrends(@Req() req: any, @Res() res: FastifyReply) {
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID missing from token");
    }

    const data = await this.usersService.getUserRoleTrends(userId);

    const responseData = new ApiResponseService(
      "User trend data generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
