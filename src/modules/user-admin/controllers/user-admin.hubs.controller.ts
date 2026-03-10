import {
  Controller,
  Get,
  UseGuards,
  Req,
  Param,
  Res,
  Query,
  UnauthorizedException,
  Post,
  Body,
  UseInterceptors,
  Put,
} from "@nestjs/common";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { AdminHubsService } from "../services/user-admin.hubs.service";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
} from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from "@blazity/nest-file-fastify";
import {
  CreateOrUpdateTeamDto,
  UpdateTeamDto,
} from "@src/modules/identity/payloads/team.payload";
import { TeamService } from "@src/modules/identity/services/team.service";
import { ExtendedFastifyRequest } from "@src/types/fastify";
import { CreateOrUpdateAdminHubDto } from "../payloads/hub.payload";
import { SalesEmailService } from "@src/modules/workspace/services/sales-email.service";
import { ExtendTrialDto } from "../payloads/trial-extension.payload";
import { AddPlanDto } from "../payloads/add-plan.payload";
import { ChangePlanDto } from "../payloads/change-plan.payload";

@Controller("api/admin")
@ApiTags("admin hubs")
@ApiBearerAuth()
export class AdminHubsController {
  constructor(
    private readonly hubsService: AdminHubsService,
    private readonly teamService: TeamService,
    private readonly salesEmailService: SalesEmailService,
  ) {}
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("hubs")
  @ApiOperation({ summary: "Get hubs for logged-in user" })
  async getHubs(@Req() req: any, @Res() res: FastifyReply) {
    // Extract user ID from the decoded JWT
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID missing from token");
    }

    const data = await this.hubsService.getHubsForUser(userId);

    const responseData = new ApiResponseService(
      "Hubs generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("hubs-summary")
  @ApiOperation({ summary: "Get summary of all hubs for user" })
  async getHubsSummary(@Req() req: any, @Res() res: FastifyReply) {
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID missing from token");
    }

    const data = await this.hubsService.getAllHubsSummaryForUser(userId);

    const responseData = new ApiResponseService(
      "Hubs summary generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("all-hubs")
  @ApiOperation({ summary: "Get paginated hubs list with search" })
  @ApiQuery({ name: "page", required: false, type: String, example: "1" })
  @ApiQuery({ name: "limit", required: false, type: String, example: "10" })
  @ApiQuery({ name: "search", required: false, type: String })
  async getAllHubs(
    @Req() req: any,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search: string = "",
    @Query("plan") plan: string = "All",
    @Query("sortBy") sortBy: "createdAt" | "updatedAt" | "name" = "createdAt",
    @Query("sortOrder") sortOrder: "asc" | "desc" = "desc",
    @Res() res: FastifyReply,
  ) {
    const userId = req.user._id;

    if (!userId) {
      throw new UnauthorizedException("User ID missing from token");
    }

    // Convert string parameters to numbers
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    // Validate sort parameters
    const validSortFields = ["createdAt", "updatedAt", "name"];
    const validatedSortBy = validSortFields.includes(sortBy)
      ? sortBy
      : "createdAt";
    const validatedSortOrder = ["asc", "desc"].includes(sortOrder)
      ? sortOrder
      : "desc";

    const data = await this.hubsService.getAllHubsForUser(
      userId,
      parsedPage || 1,
      parsedLimit || 10,
      plan,
      search,
      {
        sortBy: validatedSortBy,
        sortOrder: validatedSortOrder,
      },
    );

    const responseData = new ApiResponseService(
      "Hubs list generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("create-hub")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiOperation({ summary: "Create a new Hub as Admin" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        image: {
          type: "string",
          format: "binary",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        hubUrl: {
          type: "string",
        },
        isTrialHub: {
          type: "boolean",
          default: false,
        },
        trialId: {
          type: "string",
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor("image"))
  @ApiResponse({ status: 201, description: "Hub Created Successfully" })
  @ApiResponse({ status: 400, description: "Create Hub Failed" })
  async createHub(
    @Body() createHubDto: CreateOrUpdateAdminHubDto,
    @Res() res: FastifyReply,
    @UploadedFile() image: MemoryStorageFile,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const data = await this.teamService.create(createHubDto, user, image);
    const hub = await this.teamService.get(data.insertedId.toString());
    if (createHubDto.isTrialHub === "true") {
      const salesEmailData =
        await this.salesEmailService.updateSalesEmailRecord(
          createHubDto.trialId,
          { isHubCreated: true, createdHubId: hub._id.toString() },
        );
    }

    const responseData = new ApiResponseService(
      "Hub Created",
      HttpStatusCode.CREATED,
      hub,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get("get-hub/:teamId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiOperation({
    summary: "Retrieve Team Details",
    description: "This will retrieve team details",
  })
  @ApiResponse({ status: 200, description: "Fetch Team Request Received" })
  @ApiResponse({ status: 400, description: "Fetch Team Request Failed" })
  async getTeam(@Param("teamId") teamId: string, @Res() res: FastifyReply) {
    const data = await this.teamService.get(teamId);
    const plan = data?.plan;
    const responseObject = { ...data, plan: plan };
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      responseObject,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Put("update-hub/:teamId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiOperation({
    summary: "Update a Team",
    description: "This will update a Team",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        image: {
          type: "string",
          format: "binary",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        hubUrl: {
          type: "string",
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor("image"))
  @ApiResponse({ status: 201, description: "Team Updated Successfully" })
  @ApiResponse({ status: 400, description: "Updated Team Failed" })
  async updateTeam(
    @Param("teamId") teamId: string,
    @Body() updateTeamDto: Partial<UpdateTeamDto>,
    @Res() res: FastifyReply,
    @UploadedFile()
    image: MemoryStorageFile,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.teamService.update(teamId, updateTeamDto, user._id, image);
    const team = await this.teamService.get(teamId);
    const responseData = new ApiResponseService(
      "Team Updated",
      HttpStatusCode.CREATED,
      team,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get("hub-statistics")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiOperation({
    summary: "Get hub statistics with collaborator and workspace counts",
    description:
      "Returns collaborator count (excluding owners) and workspace count for a specific hub",
  })
  @ApiQuery({
    name: "hUbId",
    required: true,
    type: String,
    description: "Hub ID to get statistics for",
  })
  @ApiResponse({
    status: 200,
    description: "Hub statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        teamId: { type: "string" },
        teamName: { type: "string" },
        collaboratorCount: { type: "number" },
        workspaceCount: { type: "number" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Failed to retrieve hub statistics",
  })
  @ApiResponse({ status: 404, description: "hHub not found" })
  async getTeamStatistics(
    @Query("hubId") teamId: string,
    @Res() res: FastifyReply,
  ) {
    if (!teamId) {
      throw new UnauthorizedException("Hub ID is required");
    }

    const data = await this.hubsService.getTeamStatistics(teamId);

    const responseData = new ApiResponseService(
      "Hub statistics retrieved successfully",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("hub-feedback")
  @ApiOperation({ summary: "Submit billing feedback" })
  @ApiResponse({ status: 201, description: "Feedback submitted successfully" })
  async submitHubFeedback(
    @Body() { hubId, feedback }: { hubId: string; feedback: string },
    @Res() res: FastifyReply,
  ) {
    try {
      if (!hubId || feedback === undefined) {
        const responseData = new ApiResponseService(
          "hubId is required and feedback must be provided",
          HttpStatusCode.BAD_REQUEST,
          null,
        );
        return res.status(HttpStatusCode.BAD_REQUEST).send(responseData);
      }

      const result = await this.hubsService.submitHubFeedback(hubId, feedback);

      const responseData = new ApiResponseService(
        "Feedback submitted successfully",
        HttpStatusCode.CREATED,
        result,
      );

      return res.status(HttpStatusCode.CREATED).send(responseData);
    } catch (error) {
      const statusCode =
        error.message === "Hub not found"
          ? HttpStatusCode.NOT_FOUND
          : HttpStatusCode.BAD_REQUEST;

      const responseData = new ApiResponseService(
        error.message || "Failed to submit feedback",
        statusCode,
        null,
      );

      return res.status(statusCode).send(responseData);
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Extend trial period for a hub" })
  @ApiParam({
    name: "hubId",
    description: "Unique Hub ID",
    example: "69ae736e7ef406283329e75d",
  })
  @ApiBody({
    type: ExtendTrialDto,
    description: "Trial extension request body",
  })
  @ApiResponse({
    status: 200,
    description: "Trial extended successfully",
  })
  @Post("hubs/:hubId/trial/extend")
  async extendTrial(
    @Param("hubId") hubId: string,
    @Body() body: ExtendTrialDto,
    @Req() request: any,

    @Res() res: FastifyReply,
  ) {
    console.log("USER:", request.user);
    const result = await this.hubsService.extendTrial(
      hubId,
      body.extensionDays,
      body.reason,
      body.notifyCustomer,
    );

    const response = new ApiResponseService(
      "Trial extended successfully",
      HttpStatusCode.OK,
      result,
    );

    return res.status(response.httpStatusCode).send(response);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add a subscription plan to a hub" })
  @ApiParam({
    name: "hubId",
    description: "Hub ID",
    example: "69ae736e7ef406283329e75d",
  })
  @ApiBody({
    type: AddPlanDto,
    description: "Plan addition request body",
  })
  @ApiResponse({
    status: 200,
    description: "Plan added successfully",
  })
  @Post("hubs/:hubId/plans/add")
  async addPlan(
    @Param("hubId") hubId: string,
    @Body() body: AddPlanDto,
    @Req() request: any,
    @Res() res: FastifyReply,
  ) {
    const result = await this.hubsService.addPlanToHub(
      hubId,
      body.planId,
      body.effectiveDate,
      body.billingCycle,
      body.notes,
    );

    const response = new ApiResponseService(
      "Plan added successfully",
      HttpStatusCode.OK,
      result,
    );

    return res.status(response.httpStatusCode).send(response);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change hub subscription plan (upgrade/downgrade)" })
  @ApiParam({
    name: "hubId",
    description: "Hub ID",
    example: "69ae736e7ef406283329e75d",
  })
  @ApiBody({
    type: ChangePlanDto,
    description: "Plan change request body",
  })
  @ApiResponse({
    status: 200,
    description: "Plan changed successfully",
  })
  @Put("hubs/:hubId/plan/change")
  async changePlan(
    @Param("hubId") hubId: string,
    @Body() body: ChangePlanDto,
    @Req() request: any,
    @Res() res: FastifyReply,
  ) {
    const result = await this.hubsService.changeHubPlan(
      hubId,
      body.currentPlanId,
      body.newPlanId,
      body.changeType,
      body.effectiveDate,
      body.prorate,
    );

    const response = new ApiResponseService(
      "Plan changed successfully",
      HttpStatusCode.OK,
      result,
    );

    return res.status(response.httpStatusCode).send(response);
  }
}
