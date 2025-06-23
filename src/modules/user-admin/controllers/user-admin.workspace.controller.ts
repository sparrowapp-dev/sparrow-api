import {
  Controller,
  Get,
  UseGuards,
  Post,
  Res,
  Query,
  Body,
  Delete,
  Put,
  Patch,
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiExtraModels,
} from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import { AdminWorkspaceService } from "../services/user-admin.workspace.service";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  UpdateWorkspaceTypeDto,
} from "@src/modules/workspace/payloads/workspace.payload";
import { HubWorkspaceQuerySwaggerDto } from "../payloads/workspace.payload";
import {
  AddWorkspaceUserDto,
  UserWorkspaceRoleDto,
} from "@src/modules/workspace/payloads/workspaceUser.payload";
import { ExtendedFastifyRequest } from "@src/types/fastify";

@Controller("api/admin")
@ApiTags("admin workspace")
@ApiBearerAuth()
export class AdminWorkspaceController {
  constructor(
    private readonly adminWorkspaceService: AdminWorkspaceService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @ApiExtraModels(HubWorkspaceQuerySwaggerDto)
  @ApiQuery({ type: HubWorkspaceQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("hub-workspaces")
  @ApiOperation({ summary: "Get paginated workspaces for a hub" })
  async getPaginatedHubWorkspaces(
    @Query("hubId") hubId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search = "",
    @Query("sortBy")
    sortBy: "name" | "workspaceType" | "createdAt" | "updatedAt" = "createdAt",
    @Query("sortOrder") sortOrder: "asc" | "desc" = "desc",
    @Query("workspaceType") workspaceType: "PRIVATE" | "PUBLIC" | undefined,
    @Res() res: FastifyReply,
    @Req() req: any,
  ) {
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const validatedSortBy = [
      "name",
      "workspaceType",
      "createdAt",
      "updatedAt",
    ].includes(sortBy)
      ? sortBy
      : "createdAt";
    const validatedSortOrder = ["asc", "desc"].includes(sortOrder)
      ? sortOrder
      : "desc";

    const userId = req.user._id;

    const data = await this.adminWorkspaceService.getPaginatedHubWorkspaces(
      hubId,
      parsedPage,
      parsedLimit,
      search,
      { sortBy: validatedSortBy, sortOrder: validatedSortOrder },
      workspaceType,
      userId,
    );

    const responseData = new ApiResponseService(
      "Hub workspaces generated",
      HttpStatusCode.OK,
      {
        ...data,
        sortBy: validatedSortBy,
        sortOrder: validatedSortOrder,
        workspaceType,
      },
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("create-workspace")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiOperation({
    summary: "Create a new Workspace as Admin",
    description: "Admins can create a workspace with optional description",
  })
  @ApiResponse({
    status: 201,
    description: "Admin Workspace Created Successfully",
  })
  @ApiResponse({ status: 400, description: "Admin Create Workspace Failed" })
  async adminCreateWorkspace(
    @Body() adminCreateDto: CreateWorkspaceDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const data = await this.workspaceService.create(adminCreateDto, user);

    const workspace = await this.workspaceService.get(
      data.insertedId.toString(),
    );

    const responseData = new ApiResponseService(
      "Admin Workspace Created",
      HttpStatusCode.CREATED,
      workspace,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @ApiExtraModels(HubWorkspaceQuerySwaggerDto)
  @ApiQuery({ type: HubWorkspaceQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("workspace-details")
  @ApiOperation({ summary: "Get paginated resources for workspace" })
  async getPaginatedWorkspaceDetails(
    @Query("workspaceId") workspaceId: string,
    @Query("tab")
    tab: "resources" | "members" = "resources",
    @Query("page")
    page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search = "",
    @Query("resources")
    resources: "collections" | "testflows" | "environments" | "all" = "all",
    @Query("sortBy")
    sortBy: "resources" | "createdBy" | "updatedAt" = "updatedAt",
    @Query("sortOrder") sortOrder: "asc" | "desc" = "desc",
    @Res() res: FastifyReply,
  ) {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10);
    const data = await this.adminWorkspaceService.getPaginatedWorkspaceDetails(
      workspaceId,
      tab,
      pageNumber,
      limitNumber,
      search,
      resources,
      { sortBy, sortOrder },
    );
    const responseData = new ApiResponseService(
      "Collections Fetched",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @ApiExtraModels(HubWorkspaceQuerySwaggerDto)
  @ApiQuery({ type: HubWorkspaceQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("workspace-summary")
  @ApiOperation({ summary: "Get workspace summary" })
  async getWorkspaceSummary(
    @Query("workspaceId") workspaceId: string,
    @Query("hubId") hubId: string,
    @Res() res: FastifyReply,
  ) {
    const data = await this.adminWorkspaceService.getWorkspaceSummary(
      workspaceId,
      hubId,
    );
    const responseData = new ApiResponseService(
      "WorkSpaceSummary Fetched",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @ApiExtraModels(HubWorkspaceQuerySwaggerDto)
  @ApiQuery({ type: HubWorkspaceQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Delete("workspace-details")
  @ApiOperation({ summary: "Delete a Workspace " })
  async deleteWorkspace(
    @Query("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const data = await this.workspaceService.delete(workspaceId, user._id);
    const responseData = new ApiResponseService(
      "Workspace Deleted",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @ApiExtraModels(HubWorkspaceQuerySwaggerDto)
  @ApiQuery({ type: HubWorkspaceQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Put("workspace-details")
  @ApiOperation({ summary: "Edit a Workspace " })
  async editWorkspace(
    @Query("workspaceId") workspaceId: string,
    @Body() updateWorkspaceDto: Partial<UpdateWorkspaceDto>,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.workspaceService.update(workspaceId, updateWorkspaceDto, user);

    const workspace = await this.workspaceService.get(workspaceId);
    const responseData = new ApiResponseService(
      "Workspace Updated",
      HttpStatusCode.OK,
      workspace,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @ApiExtraModels(HubWorkspaceQuerySwaggerDto)
  @ApiQuery({ type: HubWorkspaceQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch("workspace-details")
  @ApiOperation({ summary: "Changing a WorkspaceType " })
  async updateWorkspaceType(
    @Query("workspaceId") workspaceId: string,
    @Body() payload: UpdateWorkspaceTypeDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.workspaceService.updateWorkspaceType(
      workspaceId,
      payload.workspaceType,
      user._id,
    );
    const workspace = await this.workspaceService.get(workspaceId);
    const responseData = new ApiResponseService(
      "Workspace Type Updated",
      HttpStatusCode.OK,
      workspace,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @ApiExtraModels(HubWorkspaceQuerySwaggerDto)
  @ApiQuery({ type: HubWorkspaceQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("workspace-details")
  @ApiOperation({ summary: "Invite Collaborartors" })
  async addUSerWorkspace(
    @Query("workspaceId") workspaceId: string,
    @Body() payload: AddWorkspaceUserDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const params = {
      users: payload.users,
      workspaceId: workspaceId,
      role: payload.role,
    };
    const response = await this.workspaceService.addUserInWorkspace(
      params,
      user,
    );
    const workspace = await this.workspaceService.get(workspaceId);
    const data = {
      ...workspace,
      ...response,
    };
    const responseData = new ApiResponseService(
      "User Added",
      HttpStatusCode.OK,
      data,
    );
    res.status(responseData.httpStatusCode).send(responseData);
  }
  @ApiExtraModels(HubWorkspaceQuerySwaggerDto)
  @ApiQuery({ type: HubWorkspaceQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Put("user-role")
  @ApiOperation({ summary: "Change user roles" })
  async changeUserRole(
    @Query("workspaceId") workspaceId: string,
    @Query("userId") userId: string,
    @Body() data: UserWorkspaceRoleDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const currentUser = request.user;
    const params = {
      userId: userId,
      workspaceId: workspaceId,
      role: data.role,
    };
    await this.workspaceService.changeUserRole(params, currentUser);
    const workspace = await this.workspaceService.get(workspaceId);
    const responseData = new ApiResponseService(
      "Role Changed",
      HttpStatusCode.OK,
      workspace,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
