// Libraries
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { FastifyReply } from "fastify";

// ---- Service
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { TestflowService } from "../services/testflow.service";

// ---- Enum
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

// ---- Guard
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";

// ---- Payload
import {
  CreateTestflowDto,
  CreateTestflowSchedularDto,
  UpdateTestflowDto,
} from "../payloads/testflow.payload";
import { CreateTestflowBlockGuard } from "../guards/plan-limits/create-testflow-block-guard";
import { CreateTestflowGuard } from "../guards/plan-limits/create-testflow-guard";
import { DecodedUserObject, ExtendedFastifyRequest } from "@src/types/fastify";
import { TestflowSchedular } from "@src/modules/common/models/testflow.model";

/**
 * Controller responsible for handling Testflow operations
 * and updates within a Workspace. It supports CRUD operations like
 * creating, fetching, updating, and deleting Testflows.
 *
 * This controller is secured using JWT authentication.
 *
 * @class TestflowController
 * @implements {TestflowService}
 */
@ApiBearerAuth()
@ApiTags("testflow")
@Controller("api/workspace")
export class TestflowController {
  /**
   * Creates an instance of TestflowController.
   *
   * @param {TestflowService} testflowService - Service for Testflow operations.
   */
  constructor(private readonly testflowService: TestflowService) {}

  /**
   * Create a new Testflow and add it to the user's Workspace.
   *
   * @param {CreateTestflowDto} createTestflowDto - Data Transfer Object for creating a Testflow.
   * @param {FastifyReply} res - Fastify reply object to send the response.
   * @returns Response with the created Testflow details.
   *
   * @description This will create a Testflow based on the input data and add it to the current user's Workspace.
   * Returns the created Testflow object in the response.
   */
  @Post("testflow")
  @ApiOperation({
    summary: "Create A Testflow",
    description:
      "This will create a testflow and add this testflow in user's workspace",
  })
  @UseGuards(JwtAuthGuard, CreateTestflowGuard)
  @ApiResponse({ status: 201, description: "Testflow Created Successfully" })
  @ApiResponse({ status: 400, description: "Create Testflow Failed" })
  async createTestflow(
    @Body() createTestflowDto: CreateTestflowDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const testflow = await this.testflowService.createTestflow(
      createTestflowDto,
      user,
    );
    const responseData = new ApiResponseService(
      "Testflow Created",
      HttpStatusCode.CREATED,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Fetch an individual Testflow by ID.
   *
   * @param {string} testflowId - The ID of the Testflow to retrieve.
   * @param {FastifyReply} res - Fastify reply object to send the response.
   * @returns Response containing the Testflow details.
   *
   * @description This will retrieve a specific Testflow using its ID,
   * returning the Testflow object if found.
   */
  @Get("testflow/:testflowId")
  @ApiOperation({
    summary: "Get Individual Testflow",
    description: "This will get individual testflow of a workspace",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: "Fetch Testflow Request Received",
  })
  @ApiResponse({ status: 400, description: "Fetch Testflow Request Failed" })
  async getTestflow(
    @Param("testflowId") testflowId: string,
    @Res() res: FastifyReply,
  ) {
    const testflow = await this.testflowService.getTestflow(testflowId);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Update an existing Testflow in the Workspace.
   *
   * @param {string} workspaceId - The ID of the Workspace where the Testflow exists.
   * @param {string} testflowId - The ID of the Testflow to update.
   * @param {Partial<UpdateTestflowDto>} updateTestflowDto - Data Transfer Object for updating the Testflow.
   * @param {FastifyReply} res - Fastify reply object to send the response.
   * @returns Response with the updated Testflow details.
   *
   * @description Updates the Testflow's details based on the provided data and returns the updated Testflow object.
   */
  @Put(":workspaceId/testflow/:testflowId")
  @ApiOperation({
    summary: "Update An Testflow",
    description: "This will update an Testflow",
  })
  @UseGuards(JwtAuthGuard, CreateTestflowBlockGuard)
  @ApiResponse({ status: 200, description: "Testflow Updated Successfully" })
  @ApiResponse({ status: 400, description: "Update Testflow Failed" })
  async updateTestflow(
    @Param("workspaceId") workspaceId: string,
    @Param("testflowId") testflowId: string,
    @Body() updateTestflowDto: Partial<UpdateTestflowDto>,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const testflow = await this.testflowService.updateTestflow(
      testflowId,
      updateTestflowDto,
      workspaceId,
      user,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Delete a specific Testflow from the Workspace.
   *
   * @param {string} workspaceId - The ID of the Workspace where the Testflow exists.
   * @param {string} testflowId - The ID of the Testflow to delete.
   * @param {FastifyReply} res - Fastify reply object to send the response.
   * @returns Response confirming the removal of the Testflow.
   *
   * @description Removes the specified Testflow from the Workspace,
   * returning a confirmation message in the response.
   */
  @Delete(":workspaceId/testflow/:testflowId")
  @ApiOperation({
    summary: "Delete a Testflow",
    description: "This will delete a Testflow",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, description: "Removed Testflow Successfully" })
  @ApiResponse({ status: 400, description: "Failed to remove Testflow" })
  async deleteTestflow(
    @Param("workspaceId") workspaceId: string,
    @Param("testflowId") testflowId: string,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const testflow = await this.testflowService.deleteTestflow(
      testflowId,
      workspaceId,
      user,
    );
    const responseData = new ApiResponseService(
      "Testflow Removed",
      HttpStatusCode.OK,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Get all Testflows for a specific Workspace.
   *
   * @param {string} workspaceId - The ID of the Workspace to retrieve Testflows for.
   * @param {FastifyReply} res - Fastify reply object to send the response.
   * @returns Response containing all Testflows in the Workspace.
   *
   * @description Fetches all Testflows associated with the given Workspace ID,
   * returning an array of Testflow objects.
   */
  @Get(":workspaceId/testflow")
  @ApiOperation({
    summary: "Get All Testflows",
    description: "This will get all testflows of a workspace",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: "Fetch Testflow Request Received",
  })
  @ApiResponse({ status: 400, description: "Fetch Testflow Request Failed" })
  async getTestflows(
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const testflow = await this.testflowService.getAllTestflows(
      workspaceId,
      user._id,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Get all Testflows for a specific Public Workspace.
   *
   * @param {string} workspaceId - The ID of the Workspace to retrieve Testflows for.
   * @param {FastifyReply} res - Fastify reply object to send the response.
   * @returns Response containing all Testflows in the Workspace.
   *
   * @description Fetches all Testflows associated with the given Workspace ID,
   * returning an array of Testflow objects.
   */
  @Get("public/:workspaceId/testflow")
  @ApiOperation({
    summary: "Get All Public Testflows",
    description: "This will get all testflows of a public workspace",
  })
  @ApiResponse({
    status: 200,
    description: "Fetch Testflow Request Received",
  })
  @ApiResponse({ status: 400, description: "Fetch Testflow Request Failed" })
  async getPublicTestflows(
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
  ) {
    const testflow =
      await this.testflowService.getAllPublicTestflows(workspaceId);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Create a new Testflow Schedular for a specific Testflow in a Workspace.
   *
   * @param {CreateTestflowSchedularDto} createTestflowSchedularDto - The schedular data to create.
   * @param {FastifyReply} res - Fastify reply object used to send the response.
   * @param {ExtendedFastifyRequest} request - The Fastify request object containing authenticated user info.
   * @returns A response indicating success or failure of the schedular creation.
   *
   * @description
   * This endpoint creates a test flow schedular associated with a specific testflow within a workspace.
   */
  @Post("create-testflow-schedule")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Create a test flow schedular",
    description:
      "Creates a new test flow schedular for a specific testflow in a workspace",
  })
  @ApiResponse({
    status: 200,
    description: "Testflow schedular created successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Failed to create a schedular",
  })
  async createTestflowSchedule(
    @Body() createTestflowSchedularDto: CreateTestflowSchedularDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
   const user = request.user;
    await this.testflowService.createTestflowSchedular(
      createTestflowSchedularDto,
      user,
    );  
    const testflow = await this.testflowService.getTestflow(createTestflowSchedularDto.testflowId);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

   /**
     * Update a specific schedule for a testflow.
     */
    @Put(':workspaceId/testflow/:testflowId/schedule/:scheduleId')
    @ApiOperation({ summary: 'Update Testflow Schedule', description: 'Update a specific schedule for a testflow.' })
    @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
    @ApiResponse({ status: 400, description: 'Failed to update schedule' })
    @UseGuards(JwtAuthGuard)
    async updateTestflowSchedule(
      @Param('workspaceId') workspaceId: string,
      @Param('testflowId') testflowId: string,
      @Param('scheduleId') scheduleId: string,
      @Body() updateScheduleDto: Partial<TestflowSchedular>,
      @Res() res: FastifyReply,
      @Req() request: ExtendedFastifyRequest,
    ) {
      const user = request.user;
      await this.testflowService.updateTestflowSchedule(
        testflowId,
        scheduleId,
        updateScheduleDto,
        workspaceId,
        user,
      );
      const testflow = await this.testflowService.getTestflow(testflowId);
      const responseData = new ApiResponseService(
        "Success",
        HttpStatusCode.OK,
        testflow,
      );
      return res.status(responseData.httpStatusCode).send(responseData);
    }

    /**
     * Delete a specific schedule from a testflow.
     */
    @Delete(':workspaceId/testflow/:testflowId/schedule/:scheduleId')
    @ApiOperation({ summary: 'Delete Testflow Schedule', description: 'Delete a specific schedule from a testflow.' })
    @ApiResponse({ status: 200, description: 'Schedule deleted successfully' })
    @ApiResponse({ status: 400, description: 'Failed to delete schedule' })
    @UseGuards(JwtAuthGuard)
    async deleteTestflowSchedule(
      @Param('workspaceId') workspaceId: string,
      @Param('testflowId') testflowId: string,
      @Param('scheduleId') scheduleId: string,
      @Res() res: FastifyReply,
      @Req() request: ExtendedFastifyRequest,
    ) {
      const user = request.user;
      await this.testflowService.deleteTestflowSchedule(
        testflowId,
        scheduleId,
        workspaceId,
        user,
      );
      const testflow = await this.testflowService.getTestflow(testflowId);
      const responseData = new ApiResponseService(
        "Success",
        HttpStatusCode.OK,
        testflow,
      );
      return res.status(responseData.httpStatusCode).send(responseData);
    }

    /**
     * Manually run a testflow schedule.
     */
    @Post(':workspaceId/testflow/:testflowId/schedule/:scheduleId/run')
    @ApiOperation({ summary: 'Run Testflow Schedule', description: 'Manually run a testflow schedule.' })
    @ApiResponse({ status: 200, description: 'Schedule run triggered successfully' })
    @ApiResponse({ status: 400, description: 'Failed to run schedule' })
    @UseGuards(JwtAuthGuard)
    async runTestflowSchedule(
      @Param('workspaceId') workspaceId: string,
      @Param('testflowId') testflowId: string,
      @Param('scheduleId') scheduleId: string,
      @Res() res: FastifyReply,
      @Req() request: ExtendedFastifyRequest,
    ) {
      const user = request.user;
      await this.testflowService.runTestflowSchedule(
        testflowId,
        scheduleId,
        workspaceId,
        user,
      );
      const testflow = await this.testflowService.getTestflow(testflowId);
      const responseData = new ApiResponseService(
        "Success",
        HttpStatusCode.OK,
        testflow,
      );
      return res.status(responseData.httpStatusCode).send(responseData);
    }

    /**
     * Delete a run history for a schedule in a testflow
     */
    @Delete(":workspaceId/testflow/:testflowId/schedule/:scheduleId/run-history/:runHistoryId")
    @ApiOperation({ summary: 'Delete Schedule Run History', description: 'Delete all run history for a schedule in a testflow.' })
    @ApiResponse({ status: 200, description: 'Run history deleted successfully' })
    @ApiResponse({ status: 400, description: 'Failed to delete run history' })
    @UseGuards(JwtAuthGuard)
    async deleteScheduleRunHistory(
      @Param("workspaceId") workspaceId: string,
      @Param("runHistoryId") runHistoryId: string,
      @Param("testflowId") testflowId: string,
      @Param("scheduleId") scheduleId: string,
      @Res() res: FastifyReply,
      @Req() request: ExtendedFastifyRequest,
    ) {
      const user = request.user;
      await this.testflowService.deleteScheduleRunHistory(workspaceId, testflowId, scheduleId, runHistoryId, user);
      const testflow = await this.testflowService.getTestflow(testflowId);
      const responseData = new ApiResponseService(
        "Success",
        HttpStatusCode.OK,
        testflow,
      );
      return res.status(responseData.httpStatusCode).send(responseData);
    }
}
