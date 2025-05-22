import {
  Controller,
  Get,
  UseGuards,
  Res,
  Query,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from "@nestjs/common";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiExtraModels,
  ApiResponse,
  ApiBody,
} from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import { AdminMembersService } from "../services/user-admin.members.service";
import {
  HubMembersQuerySwaggerDto,
  HubInvitesQuerySwaggerDto,
} from "../payloads/members.payload";
import { TeamUserService } from "@src/modules/identity/services/team-user.service";
import { TeamService } from "@src/modules/identity/services/team.service";
import { AddTeamUserDto } from "@src/modules/identity/payloads/teamUser.payload";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";

@Controller("api/admin")
@ApiTags("admin hub members")
@ApiBearerAuth()
export class AdminMembersController {
  constructor(
    private readonly adminMembersService: AdminMembersService,
    private readonly teamUserService: TeamUserService,
    private readonly teamService: TeamService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @ApiExtraModels(HubMembersQuerySwaggerDto)
  @ApiQuery({ type: HubMembersQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("hub-members")
  @ApiOperation({ summary: "Get paginated members for a hub" })
  async getHubMembers(
    @Query("hubId") hubId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search = "",
    @Res() res: FastifyReply,
  ) {
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const data = await this.adminMembersService.getPaginatedHubMembers(
      hubId,
      parsedPage,
      parsedLimit,
      search,
    );

    const responseData = new ApiResponseService(
      "Hub members generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @ApiExtraModels(HubInvitesQuerySwaggerDto)
  @ApiQuery({ type: HubInvitesQuerySwaggerDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("hub-invites")
  @ApiOperation({ summary: "Get paginated invites for a hub" })
  async getHubInvites(
    @Query("hubId") hubId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search = "",
    @Res() res: FastifyReply,
  ) {
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const data = await this.adminMembersService.getPaginatedHubInvites(
      hubId,
      parsedPage,
      parsedLimit,
      search,
    );

    const responseData = new ApiResponseService(
      "Hub invites generated",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Send invites to users to join a hub
   */
  @Post("hub/:hubId/invite")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiOperation({
    summary: "Send invites to users for a hub",
    description:
      "This will send invitation emails to multiple users to join a hub",
  })
  @ApiBody({ type: AddTeamUserDto })
  @ApiResponse({
    status: 201,
    description: "Invites sent successfully",
  })
  @ApiResponse({ status: 404, description: "Hub not found" })
  @ApiResponse({
    status: 401,
    description: "Only an Admin or Owner can send invites",
  })
  @ApiResponse({ status: 400, description: "Failed to send invites" })
  async sendHubInvites(
    @Param("hubId") hubId: string,
    @Body() addTeamUserDto: AddTeamUserDto,
    @Res() res: FastifyReply,
  ) {
    try {
      await this.teamUserService.sendInvite({
        teamId: hubId,
        ...addTeamUserDto,
      });

      const hub = await this.teamService.get(hubId);

      const responseData = new ApiResponseService(
        "User invites sent successfully",
        HttpStatusCode.OK,
        hub,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    } catch (error) {
      console.error("Error sending hub invites:", error);

      const responseData = new ApiResponseService(
        error.message || "Failed to send invites",
        error.status || HttpStatusCode.BAD_REQUEST,
        null,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    }
  }

  /**
   * Withdraw a pending invite
   */
  @Delete("hub/:hubId/invite/:email")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiOperation({
    summary: "Withdraw a pending invite",
    description:
      "This will remove a pending invitation for a specific email address",
  })
  @ApiResponse({
    status: 200,
    description: "Invitation withdrawn successfully",
  })
  @ApiResponse({ status: 400, description: "Failed to withdraw invitation" })
  @ApiResponse({ status: 404, description: "Hub or invitation not found" })
  async withdrawHubInvite(
    @Param("hubId") hubId: string,
    @Param("email") email: string,
    @Res() res: FastifyReply,
  ) {
    try {
      await this.teamUserService.removeInviteByOwner(hubId, email);

      const hub = await this.teamService.get(hubId);

      const responseData = new ApiResponseService(
        "Invitation withdrawn successfully",
        HttpStatusCode.OK,
        hub,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    } catch (error) {
      console.error("Error withdrawing invite:", error);

      const responseData = new ApiResponseService(
        error.message || "Failed to withdraw invitation",
        error.status || HttpStatusCode.BAD_REQUEST,
        null,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    }
  }

  /**
   * Resend an invitation
   */
  @Post("hub/:hubId/invite/:email/resend")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiOperation({
    summary: "Resend an invitation email",
    description:
      "This will resend an invitation email to a previously invited user",
  })
  @ApiResponse({
    status: 200,
    description: "Invitation resent successfully",
  })
  @ApiResponse({ status: 400, description: "Failed to resend invitation" })
  @ApiResponse({ status: 404, description: "Hub or invitation not found" })
  async resendHubInvite(
    @Param("hubId") hubId: string,
    @Param("email") email: string,
    @Res() res: FastifyReply,
  ) {
    try {
      await this.teamUserService.resendInvite(hubId, email);

      const hub = await this.teamService.get(hubId);

      const responseData = new ApiResponseService(
        "Invitation resent successfully",
        HttpStatusCode.OK,
        hub,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    } catch (error) {
      console.error("Error resending invite:", error);

      const responseData = new ApiResponseService(
        error.message || "Failed to resend invitation",
        error.status || HttpStatusCode.BAD_REQUEST,
        null,
      );

      return res.status(responseData.httpStatusCode).send(responseData);
    }
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Put("user-hubrole")
  @ApiOperation({ summary: "Demote a admin in team" })
  async demoteToMember(
    @Query("userId") userId: string,
    @Query("teamId") teamId: string,
    @Res() res: FastifyReply,
  ) {
    await this.teamUserService.demoteTeamAdmin({ teamId, userId });
    const team = await this.teamService.get(teamId);
    const responseData = new ApiResponseService(
      "Admin Demoted",
      HttpStatusCode.OK,
      team,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("user-hubrole")
  @ApiOperation({ summary: "Add Another Admin for a team" })
  async promoteToAdmin(
    @Query("userId") userId: string,
    @Query("teamId") teamId: string,
    @Res() res: FastifyReply,
  ) {
    await this.teamUserService.addAdmin({ teamId, userId });
    const team = await this.teamService.get(teamId);
    const responseData = new ApiResponseService(
      "Admin added",
      HttpStatusCode.OK,
      team,
    );
    res.status(responseData.httpStatusCode).send(responseData);
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Delete("user-hubrole")
  @ApiOperation({ summary: "Remove user from a hub" })
  async removeUserinTeam(
    @Query("userId") userId: string,
    @Query("teamId") teamId: string,
    @Res() res: FastifyReply,
  ) {
    await this.teamUserService.removeUser({ teamId, userId });
    const team = await this.teamService.get(teamId);
    const responseData = new ApiResponseService(
      "User Removed",
      HttpStatusCode.OK,
      team,
    );
    res.status(responseData.httpStatusCode).send(responseData);
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Delete("deleteuser-workspace")
  @ApiOperation({ summary: "Remove user from a workspace" })
  async removeUserinWorkspace(
    @Query("workspaceId") workspaceId: string,
    @Query("userId") userId: string,
    @Res() res: FastifyReply,
  ) {
    const params = {
      userId: userId,
      workspaceId: workspaceId,
    };
    await this.workspaceService.removeUserFromWorkspace(params);
    const workspace = await this.workspaceService.get(workspaceId);
    const responseData = new ApiResponseService(
      "User Removed",
      HttpStatusCode.OK,
      workspace,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
