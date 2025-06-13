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
import { PlanService } from "@src/modules/identity/services/plan.service";
import { Plan } from "@src/modules/common/models/plan.model";

@Controller("api/admin")
@ApiTags("admin hubs")
@ApiBearerAuth()
export class AdminHubsController {
  constructor(
    private readonly hubsService: AdminHubsService,
    private readonly teamService: TeamService,
    private readonly planService: PlanService,
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
      },
    },
  })
  @UseInterceptors(FileInterceptor("image"))
  @ApiResponse({ status: 201, description: "Hub Created Successfully" })
  @ApiResponse({ status: 400, description: "Create Hub Failed" })
  async createHub(
    @Body() createHubDto: CreateOrUpdateTeamDto,
    @Res() res: FastifyReply,
    @UploadedFile() image: MemoryStorageFile,
  ) {
    const data = await this.teamService.create(createHubDto, image);
    const hub = await this.teamService.get(data.insertedId.toString());

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
    let data = await this.teamService.get(teamId);
    const plan = await this.planService.get(data?.plan?.id?.toString());
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
  ) {
    await this.teamService.update(teamId, updateTeamDto, image);
    const team = await this.teamService.get(teamId);
    const responseData = new ApiResponseService(
      "Team Updated",
      HttpStatusCode.CREATED,
      team,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
