import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  CreateEnvironmentDto,
  UpdateEnvironmentDto,
} from "../payloads/environment.payload";
import { FastifyReply } from "fastify";
import { EnvironmentService } from "../services/environment.service";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { EnvironmentType } from "@src/modules/common/models/environment.model";
import { WorkspaceService } from "../services/workspace.service";

@ApiBearerAuth()
@ApiTags("environment")
@Controller("api/workspace")
@UseGuards(JwtAuthGuard)
export class EnvironmentController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @Post("environment")
  @ApiOperation({
    summary: "Create A Environment",
    description:
      "This will create a environment and add this environment in user's workspace",
  })
  @ApiResponse({ status: 201, description: "Environment Created Successfully" })
  @ApiResponse({ status: 400, description: "Create Environment Failed" })
  async createCollection(
    @Body() createEnvironmentDto: CreateEnvironmentDto,
    @Res() res: FastifyReply,
  ) {
    const workspaceId = createEnvironmentDto.workspaceId;
    const data = await this.environmentService.createEnvironment(
      createEnvironmentDto,
      EnvironmentType.LOCAL,
    );
    const environment = await this.environmentService.getEnvironment(
      data.insertedId.toString(),
    );
    await this.workspaceService.addEnvironmentInWorkSpace(workspaceId, {
      id: environment._id,
      name: environment.name,
      type: environment.type,
    });
    const responseData = new ApiResponseService(
      "Environment Created",
      HttpStatusCode.CREATED,
      environment,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Delete(":workspaceId/environment/:environmentId")
  @ApiOperation({
    summary: "Delete a Environment",
    description: "This will delete a environment",
  })
  @ApiResponse({ status: 201, description: "Removed Environment Successfully" })
  @ApiResponse({ status: 400, description: "Failed to remove Environment" })
  async deleteEnvironment(
    @Param("workspaceId") workspaceId: string,
    @Param("environmentId") environmentId: string,
    @Res() res: FastifyReply,
  ) {
    const environment = await this.environmentService.deleteEnvironment(
      environmentId,
      workspaceId,
    );

    await this.workspaceService.deleteEnvironmentInWorkSpace(
      workspaceId.toString(),
      environmentId,
    );
    const responseData = new ApiResponseService(
      "Environment Removed",
      HttpStatusCode.OK,
      environment,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get(":workspaceId/environment")
  @ApiOperation({
    summary: "Get All Environments",
    description: "This will get all environments of a workspace",
  })
  @ApiResponse({
    status: 200,
    description: "Fetch Environment Request Received",
  })
  @ApiResponse({ status: 400, description: "Fetch Environment Request Failed" })
  async getEnvironment(
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
  ) {
    const environment = await this.environmentService.getAllEnvironments(
      workspaceId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      environment,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Put(":workspaceId/environment/:environmentId")
  @ApiOperation({
    summary: "Update An Environment",
    description: "This will update an environment",
  })
  @ApiResponse({ status: 200, description: "Environment Updated Successfully" })
  @ApiResponse({ status: 400, description: "Update Environment Failed" })
  async updateEnvironment(
    @Param("workspaceId") workspaceId: string,
    @Param("environmentId") environmentId: string,
    @Body() updateEnvironmentDto: UpdateEnvironmentDto,
    @Res() res: FastifyReply,
  ) {
    await this.environmentService.updateEnvironment(
      environmentId,
      updateEnvironmentDto,
      workspaceId,
    );

    const environment = await this.environmentService.getEnvironment(
      environmentId,
    );
    await this.workspaceService.updateEnvironmentInWorkSpace(
      workspaceId,
      environmentId,
      updateEnvironmentDto.name,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      environment,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get(":workspaceId/environment/:environmentId")
  @ApiOperation({
    summary: "Get Individual Environments",
    description: "This will get individual environment of a workspace",
  })
  @ApiResponse({
    status: 200,
    description: "Fetch Environment Request Received",
  })
  @ApiResponse({ status: 400, description: "Fetch Environment Request Failed" })
  async getIndividualEnvironment(
    @Param("workspaceId") workspaceId: string,
    @Param("environmentId") environmentId: string,
    @Res() res: FastifyReply,
  ) {
    const environment = await this.environmentService.getIndividualEnvironment(
      workspaceId,
      environmentId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      environment,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
