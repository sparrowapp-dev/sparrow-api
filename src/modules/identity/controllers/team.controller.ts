import {
  Controller,
  Body,
  Get,
  Delete,
  Post,
  UseGuards,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { TeamService } from "../services/team.service";
import { CreateOrUpdateTeamDto } from "../payloads/team.payload";
import { BlacklistGuard } from "@src/modules/common/guards/blacklist.guard";
import { TeamUserService } from "../services/team-user.service";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
/**
 * Team Controller
 */
@ApiBearerAuth()
@ApiTags("team")
@Controller("api/team")
@UseGuards(JwtAuthGuard, BlacklistGuard)
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly teamUserService: TeamUserService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a new  Team",
    description: "This will Create a  new Team",
  })
  @ApiResponse({ status: 201, description: "Team Created Successfully" })
  @ApiResponse({ status: 400, description: "Create Team Failed" })
  async createTeam(
    @Body() createTeamDto: CreateOrUpdateTeamDto,
    @Res() res: FastifyReply,
  ) {
    const data = await this.teamService.create(createTeamDto);
    const team = await this.teamService.get(data.insertedId.toString());
    const responseData = new ApiResponseService(
      "Team Created",
      HttpStatusCode.CREATED,
      team,
    );

    res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get(":teamId")
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

  @Delete(":teamId")
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

  @Post(":teamId/user/:userId")
  @ApiOperation({
    summary: "Add A User in Team",
    description: "This will add a user in your Team",
  })
  @ApiResponse({ status: 201, description: "User Added Successfully" })
  @ApiResponse({ status: 400, description: "Failed to add user" })
  async addUserInTeam(
    @Param("teamId") teamId: string,
    @Param("userId") userId: string,
    @Res() res: FastifyReply,
  ) {
    await this.teamUserService.addUser({ teamId, userId });
    const team = await this.teamService.get(teamId);
    const responseData = new ApiResponseService(
      "User Added in Team",
      HttpStatusCode.OK,
      team,
    );
    res.status(responseData.httpStatusCode).send(responseData);
  }

  @Delete(":teamId/user/:userId")
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
    const data = await this.teamUserService.removeUser({ teamId, userId });
    const responseData = new ApiResponseService(
      "User Removed",
      HttpStatusCode.OK,
      data,
    );
    res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post(":teamId/owner/:userId")
  @ApiOperation({
    summary: "Add Another Owner For a Team",
    description: "This will add another owner for a team",
  })
  @ApiResponse({ status: 201, description: "Team Owner Added Successfully" })
  @ApiResponse({ status: 400, description: "Failed to add team owner" })
  async addTeamOwner(
    @Param("teamId") teamId: string,
    @Param("userId") userId: string,
    @Res() res: FastifyReply,
  ) {
    await this.teamUserService.addOwner({ teamId, userId });
    const team = await this.teamService.get(teamId);
    const responseData = new ApiResponseService(
      "Owner added",
      HttpStatusCode.OK,
      team,
    );
    res.status(responseData.httpStatusCode).send(responseData);
  }
}
