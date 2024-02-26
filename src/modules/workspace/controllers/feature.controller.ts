import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
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
import { AddFeatureDto, UpdateFeatureDto } from "../payloads/feature.payload";
import { FastifyReply } from "fastify";
import { FeatureService } from "../services/feature.service";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
/**
 * Feature Controller
 */
@ApiBearerAuth()
@ApiTags("feature")
@Controller("api/feature")
@UseGuards(JwtAuthGuard)
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Post()
  @ApiOperation({
    summary: "Add a User",
    description: "You can add a feature",
  })
  @ApiResponse({ status: 201, description: "Feature Added" })
  @ApiResponse({ status: 400, description: "Failed to add feature" })
  async addFeature(
    @Body() addFeatureDto: AddFeatureDto,
    @Res() res: FastifyReply,
  ) {
    await this.featureService.addFeature(addFeatureDto);
    const feature = await this.featureService.getFeature(addFeatureDto.name);
    const responseData = new ApiResponseService(
      "Feature Added",
      HttpStatusCode.CREATED,
      feature,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get(":name")
  @ApiOperation({
    summary: "Get a Feature",
    description: "This will retrieve a feature ",
  })
  @ApiResponse({
    status: 200,
    description: "Feature Received Successfullt",
  })
  @ApiResponse({ status: 400, description: "Failed to fetch Feature" })
  async getFeature(@Param("name") name: string, @Res() res: FastifyReply) {
    const feature = await this.featureService.getFeature(name);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      feature,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Put(":name")
  @ApiOperation({
    summary: "Update a Feature",
    description: "This will update a feature",
  })
  @ApiResponse({ status: 200, description: "Feature Updated Successfully" })
  @ApiResponse({ status: 400, description: "Update Feature Failed" })
  async updateFeature(
    @Param("name") name: string,
    @Body() updateFeatureDto: UpdateFeatureDto,
    @Res() res: FastifyReply,
  ) {
    await this.featureService.updateFeature(name, updateFeatureDto);

    const feature = await this.featureService.getFeature(name);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      feature,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Delete(":name")
  @ApiOperation({
    summary: "Delete a Feature",
    description: "This will delete a feature",
  })
  @ApiResponse({ status: 201, description: "Removed Feature Successfully" })
  @ApiResponse({ status: 400, description: "Failed to remove Feature" })
  async deleteFeature(@Param("name") name: string, @Res() res: FastifyReply) {
    const feature = await this.featureService.deleteFeature(name);

    const responseData = new ApiResponseService(
      "Feature Removed",
      HttpStatusCode.OK,
      feature,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
