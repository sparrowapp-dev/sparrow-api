import {
  Controller,
  Body,
  Get,
  Delete,
  Post,
  UseGuards,
  Param,
  Res,
  Put,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { TeamService } from "../services/team.service";
import { CreateOrUpdateTeamDto, UpdateTeamDto } from "../payloads/team.payload";
import { TeamUserService } from "../services/team-user.service";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { AddTeamUserDto } from "../payloads/teamUser.payload";
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from "@blazity/nest-file-fastify";
import { UserService } from "../services/user.service";
/**
 * Team Controller
 */
@ApiBearerAuth()
@ApiTags("team")
@Controller("api/team")
// @UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly teamUserService: TeamUserService,
    private readonly userService: UserService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Create a new  Team",
    description: "This will Create a  new Team",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        image: {
          type: "string", // Use string instead of file for OpenAPI 3.0
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
  @ApiResponse({ status: 201, description: "Team Created Successfully" })
  @ApiResponse({ status: 400, description: "Create Team Failed" })
  async createTeam(
    @Body() createTeamDto: CreateOrUpdateTeamDto,
    @Res() res: FastifyReply,
    @UploadedFile()
    image: MemoryStorageFile,
  ) {
    const data = await this.teamService.create(createTeamDto, image);
    const team = await this.teamService.get(data.insertedId.toString());
    const responseData = new ApiResponseService(
      "Team Created",
      HttpStatusCode.CREATED,
      team,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get(":teamId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Retrieve Team Details",
    description: "This will retrieve team details",
  })
  @ApiResponse({ status: 200, description: "Fetch Team Request Received" })
  @ApiResponse({ status: 400, description: "Fetch Team Request Failed" })
  async getTeam(@Param("teamId") teamId: string, @Res() res: FastifyReply) {
    const data = await this.teamService.get(teamId);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Put(":teamId")
  @UseGuards(JwtAuthGuard)
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

  @Delete(":teamId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Delete a team",
    description: "This will delete a team",
  })
  @ApiResponse({ status: 200, description: "Team Deleted Successfully" })
  @ApiResponse({ status: 400, description: "Delete Team Failed" })
  async deleteTeam(@Param("teamId") teamId: string, @Res() res: FastifyReply) {
    const data = await this.teamService.delete(teamId);
    const responseData = new ApiResponseService(
      "Team Deleted",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get("user/:userId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Retreive User's all Teams",
    description: "This will retreive all teams of a User",
  })
  @ApiResponse({
    status: 200,
    description: "All Team Details fetched Succesfully",
  })
  @ApiResponse({ status: 400, description: "Failed to fetch all team details" })
  async getAllTeams(@Param("userId") userId: string, @Res() res: FastifyReply) {
    const data = await this.teamService.getAllTeams(userId);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      data,
    );
    res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post(":teamId/user")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Sends multiple invites to users within a team.",
    description: "This will add multiple users in your Team",
  })
  @ApiResponse({
    status: 201,
    description: "Invite has been sent successfully.",
  })
  @ApiResponse({ status: 404, description: "Team not Found." })
  @ApiResponse({
    status: 401,
    description: "Only an Admin or Owner can send the invite.",
  })
  @ApiResponse({ status: 400, description: "Failed to add users." })
  async addUserInTeam(
    @Param("teamId") teamId: string,
    @Body() addTeamUserDto: AddTeamUserDto,
    @Res() res: FastifyReply,
  ) {
    await this.teamUserService.sendInvite({
      teamId,
      ...addTeamUserDto,
    });
    const team = await this.teamService.get(teamId);
    const response = {
      ...team,
    };
    const responseData = new ApiResponseService(
      "User Invite Request Sent to Join Team",
      HttpStatusCode.OK,
      response,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Delete(":teamId/user/:userId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Remove A User From Team",
    description: "This will remove a another user from Team",
  })
  @ApiResponse({ status: 201, description: "User Deleted Successfully" })
  @ApiResponse({ status: 400, description: "Failed to delete user" })
  async removeUserInTeam(
    @Param("teamId") teamId: string,
    @Param("userId") userId: string,
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

  @Post(":teamId/admin/:userId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Add Another Admin For a Team",
    description: "This will add another admin for a team",
  })
  @ApiResponse({ status: 201, description: "Team Admin Added Successfully" })
  @ApiResponse({ status: 400, description: "Failed to add team admin" })
  async addTeamAdmin(
    @Param("teamId") teamId: string,
    @Param("userId") userId: string,
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

  @Put(":teamId/admin/:userId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Demote a Admin in Team",
    description: "This will demote admin in a team",
  })
  @ApiResponse({ status: 201, description: "Team Admin demoted Successfully" })
  @ApiResponse({ status: 400, description: "Failed to demote team admin" })
  async demoteTeamAdmin(
    @Param("teamId") teamId: string,
    @Param("userId") userId: string,
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

  @Post(":teamId/owner/:userId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Change Owner in a Team",
    description: "This will change the owner in a team",
  })
  @ApiResponse({ status: 201, description: "Team Owner Change Successfully" })
  @ApiResponse({ status: 400, description: "Failed to change team owner" })
  async changeOwner(
    @Param("teamId") teamId: string,
    @Param("userId") userId: string,
    @Res() res: FastifyReply,
  ) {
    await this.teamUserService.changeOwner({ teamId, userId });
    const team = await this.teamService.get(teamId);
    const responseData = new ApiResponseService(
      "Owner changed",
      HttpStatusCode.OK,
      team,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Put(":teamId/leave")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Leave the Team",
    description: "This will be for to leave a team",
  })
  @ApiResponse({ status: 201, description: "Leave Team Successfully" })
  @ApiResponse({ status: 400, description: "Failed to leave team" })
  async leaveTeam(@Param("teamId") teamId: string, @Res() res: FastifyReply) {
    await this.teamUserService.leaveTeam(teamId);
    const team = await this.teamService.get(teamId);
    const responseData = new ApiResponseService(
      "User left the team",
      HttpStatusCode.OK,
      team,
    );
    res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get(":teamId/user/:userId/disableTeamNewInvite")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Disable new Invite tag",
    description: "This will return  information about a specific user",
  })
  async disableTeamNewInvite(
    @Param("userId") userId: string,
    @Param("teamId") teamId: string,
    @Res() res: FastifyReply,
  ) {
    const user = await this.userService.getUserById(userId);
    const data = await this.teamService.disableTeamNewInvite(
      userId,
      teamId,
      user,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post(":teamId/invite/user/accept/:inviteId")
  @ApiOperation({
    summary: "Create a Invite",
    description: "",
  })
  @ApiResponse({
    status: 201,
    description: "Invite successfully accepted and added to the team.",
  })
  @ApiResponse({ status: 400, description: "Failed to Accept Invite." })
  @ApiResponse({ status: 404, description: "Team or Request not Found." })
  async acceptInvitebyEmail(
    @Param("teamId") teamId: string,
    @Param("inviteId") inviteId: string,
    @Res() res: FastifyReply,
  ) {
    const data = await this.teamUserService.acceptInviteByEmail(
      inviteId,
      teamId,
    );
    const responseData = new ApiResponseService(
      "User joined the hub",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post(":teamId/invite/user/accept")
  @ApiOperation({
    summary: "It is to Accept the Invite.",
    description: "",
  })
  @ApiResponse({
    status: 201,
    description: "Invite successfully accepted and added to the team.",
  })
  @ApiResponse({ status: 400, description: "Failed to Accept Invite." })
  @ApiResponse({ status: 404, description: "Team or Request not Found." })
  @UseGuards(JwtAuthGuard)
  async acceptInvite(
    @Param("teamId") teamId: string,
    @Res() res: FastifyReply,
  ) {
    const data = await this.teamUserService.acceptInvite(teamId);
    const responseData = new ApiResponseService(
      "User joined the hub",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Delete(":teamId/invite/not-accepted/:email")
  @ApiOperation({
    summary: "Remove the Invite",
    description: "",
  })
  @ApiResponse({
    status: 201,
    description: "Invitation Removed from Team Successfully",
  })
  @ApiResponse({ status: 400, description: "Failed to Remove Invitation." })
  @ApiResponse({ status: 404, description: "Team or Request not Found." })
  @UseGuards(JwtAuthGuard)
  async removeNewInviteByOwner(
    @Param("teamId") teamId: string,
    @Param("email") email: string,
    @Res() res: FastifyReply,
  ) {
    await this.teamUserService.removeInviteByOwner(teamId, email);
    const responseData = new ApiResponseService(
      "Removed Invite from hub",
      HttpStatusCode.OK,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Delete(":teamId/invite/not-accepted")
  @ApiOperation({
    summary: "Remove the Invite",
    description: "",
  })
  @ApiResponse({
    status: 201,
    description: "Invitation Removed from Team Successfully",
  })
  @ApiResponse({ status: 400, description: "Failed to Remove Invitation." })
  @ApiResponse({ status: 404, description: "Team or Request not Found." })
  @UseGuards(JwtAuthGuard)
  async removeNewInvite(
    @Param("teamId") teamId: string,
    @Res() res: FastifyReply,
  ) {
    await this.teamUserService.removeInviteUser(teamId);
    const responseData = new ApiResponseService(
      "Removed Invite from hub",
      HttpStatusCode.OK,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post(":teamId/invite/resend/:email")
  @ApiOperation({
    summary: "Resend Invite",
    description: "",
  })
  @ApiResponse({
    status: 201,
    description: "Invite resent successfully!",
  })
  @ApiResponse({ status: 400, description: "Failed to Remove Invitation." })
  @ApiResponse({ status: 404, description: "Team or Request not Found." })
  @UseGuards(JwtAuthGuard)
  async resendNewInvite(
    @Param("teamId") teamId: string,
    @Param("email") email: string,
    @Res() res: FastifyReply,
  ) {
    const data = await this.teamUserService.resendInvite(teamId, email);
    const responseData = new ApiResponseService(
      "Resend Invite to the hub",
      HttpStatusCode.OK,
      data,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
