import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

import { PlanService } from "../services/plan.service";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
/**
 * Plan Controller
 */
@ApiTags("plan")
@Controller("api/plan")
@UseGuards(JwtAuthGuard)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  // @Post()
  // @ApiOperation({
  //   summary: "Create a new Plan",
  //   description: "This will Create a new Plan",
  // })
  // @ApiBody({
  //   schema: {
  //     type: "object",
  //     properties: {
  //       name: {
  //         type: "string",
  //       },
  //       description: {
  //         type: "string",
  //       },
  //     },
  //   },
  // })
  // @ApiResponse({ status: 201, description: "Plan Created Successfully" })
  // @ApiResponse({ status: 400, description: "Create Plan Failed" })
  // async createPlan(
  //   @Body() createPlanDto: CreateOrUpdatePlanDto,
  //   @Res() res: FastifyReply,
  // ) {
  //   const data = await this.planService.create(createPlanDto);
  //   const plan = await this.planService.get(data.insertedId.toString());
  //   const responseData = new ApiResponseService(
  //     "Plan Created",
  //     HttpStatusCode.CREATED,
  //     plan,
  //   );

  //   return res.status(responseData.httpStatusCode).send(responseData);
  // }

  @Get(":planId")
  @ApiOperation({
    summary: "Retrieve Plan Details",
    description: "This will retrieve plan details",
  })
  @ApiResponse({ status: 200, description: "Fetch Plan Request Received" })
  @ApiResponse({ status: 400, description: "Fetch Plan Request Failed" })
  async getTeam(@Param("planId") planId: string, @Res() res: FastifyReply) {
    const data = await this.planService.get(planId);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get("list")
  @ApiOperation({
    summary: "Retreive Plans's List",
    description: "This will retreive all plans",
  })
  @ApiResponse({
    status: 200,
    description: "All Plan Details fetched Succesfully",
  })
  @ApiResponse({ status: 400, description: "Failed to fetch all plan details" })
  async getAllTeams(@Res() res: FastifyReply) {
    const data = await this.planService.getAllPlans();
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      data,
    );
    res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("details")
  @ApiOperation({
    summary: "Retrieve Multiple Plan Details",
    description: "This will retrieve plan details for given plan IDs",
  })
  @ApiResponse({ status: 200, description: "Fetched Plan Details" })
  @ApiResponse({ status: 404, description: "Not Found Plan Details." })
  @ApiResponse({ status: 400, description: "Invalid Request" })
  async getPlans(
    @Body() body: { planIds: string[] },
    @Res() res: FastifyReply,
  ) {
    const data = await this.planService.getPlansByIds(body.planIds);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
