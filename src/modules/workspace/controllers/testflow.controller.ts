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
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { TestflowService } from "../services/testflow.service";
import {
  CreateTestflowDto,
  UpdateTestflowDto,
} from "../payloads/testflow.payload";

@ApiBearerAuth()
@ApiTags("testflow")
@Controller("api/workspace")
@UseGuards(JwtAuthGuard)
export class TestflowController {
  constructor(private readonly testflowService: TestflowService) {}

  @Post("testflow")
  @ApiOperation({
    summary: "Create A Testflow",
    description:
      "This will create a testflow and add this testflow in user's workspace",
  })
  @ApiResponse({ status: 201, description: "Testflow Created Successfully" })
  @ApiResponse({ status: 400, description: "Create Testflow Failed" })
  async createTestflow(
    @Body() createTestflowDto: CreateTestflowDto,
    @Res() res: FastifyReply,
  ) {
    const testflow = await this.testflowService.createTestflow(
      createTestflowDto,
    );
    const responseData = new ApiResponseService(
      "Testflow Created",
      HttpStatusCode.CREATED,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get("testflow/:testflowId")
  @ApiOperation({
    summary: "Get Individual Testflow",
    description: "This will get individual testflow of a workspace",
  })
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

  @Put(":workspaceId/testflow/:testflowId")
  @ApiOperation({
    summary: "Update An Testflow",
    description: "This will update an Testflow",
  })
  @ApiResponse({ status: 200, description: "Testflow Updated Successfully" })
  @ApiResponse({ status: 400, description: "Update Testflow Failed" })
  async updateTestflow(
    @Param("workspaceId") workspaceId: string,
    @Param("testflowId") testflowId: string,
    @Body() updateTestflowDto: Partial<UpdateTestflowDto>,
    @Res() res: FastifyReply,
  ) {
    const testflow = await this.testflowService.updateTestflow(
      testflowId,
      updateTestflowDto,
      workspaceId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Delete(":workspaceId/testflow/:testflowId")
  @ApiOperation({
    summary: "Delete a Testflow",
    description: "This will delete a Testflow",
  })
  @ApiResponse({ status: 201, description: "Removed Testflow Successfully" })
  @ApiResponse({ status: 400, description: "Failed to remove Testflow" })
  async deleteTestflow(
    @Param("workspaceId") workspaceId: string,
    @Param("testflowId") testflowId: string,
    @Res() res: FastifyReply,
  ) {
    const testflow = await this.testflowService.deleteTestflow(
      testflowId,
      workspaceId,
    );
    const responseData = new ApiResponseService(
      "Testflow Removed",
      HttpStatusCode.OK,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get(":workspaceId/testflow")
  @ApiOperation({
    summary: "Get All Testflows",
    description: "This will get all testflows of a workspace",
  })
  @ApiResponse({
    status: 200,
    description: "Fetch Testflow Request Received",
  })
  @ApiResponse({ status: 400, description: "Fetch Testflow Request Failed" })
  async getTestflows(
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
  ) {
    const testflow = await this.testflowService.getAllTestflows(workspaceId);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      testflow,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
