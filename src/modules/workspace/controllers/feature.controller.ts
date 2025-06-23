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
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { FastifyReply } from "fastify";
// ---- Payload
import { AddFeatureDto, UpdateFeatureDto } from "../payloads/feature.payload";

// ---- Services
import { FeatureService } from "../services/feature.service";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";

// ---- Enum
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

// ---- Guard
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { ExtendedFastifyRequest } from "@src/types/fastify";

/**
 * Feature Controller
 *
 * This controller handles all operations related to features, including
 * adding, updating, deleting, and retrieving features.
 */
@ApiBearerAuth()
@ApiTags("feature")
@Controller("api/feature")
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  /**
   * Add a new feature.
   *
   * @param addFeatureDto - Data transfer object containing the feature details.
   * @param res - Fastify response object.
   */
  @Post()
  @ApiOperation({
    summary: "Add a Feature",
    description: "You can add a feature",
  })
  @ApiResponse({ status: 201, description: "Feature Added" })
  @ApiResponse({ status: 400, description: "Failed to add feature" })
  @UseGuards(JwtAuthGuard)
  async addFeature(
    @Body() addFeatureDto: AddFeatureDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.featureService.addFeature(addFeatureDto, user._id);
    // Retrieve the added feature for confirmation
    const feature = await this.featureService.getFeature(addFeatureDto.name);
    const responseData = new ApiResponseService(
      "Feature Added",
      HttpStatusCode.CREATED,
      feature,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Update an existing feature.
   *
   * @param name - Name of the feature to update.
   * @param updateFeatureDto - Data transfer object containing the updated feature details.
   * @param res - Fastify response object.
   */
  @Put(":name")
  @ApiOperation({
    summary: "Update a Feature",
    description: "This will update a feature",
  })
  @ApiResponse({ status: 200, description: "Feature Updated Successfully" })
  @ApiResponse({ status: 400, description: "Update Feature Failed" })
  @UseGuards(JwtAuthGuard)
  async updateFeature(
    @Param("name") name: string,
    @Body() updateFeatureDto: UpdateFeatureDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.featureService.updateFeature(name, updateFeatureDto, user._id);
    // Retrieve the updated feature for confirmation
    const feature = await this.featureService.getFeature(name);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      feature,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Delete a feature.
   *
   * @param name - Name of the feature to delete.
   * @param res - Fastify response object.
   */
  @Delete(":name")
  @ApiOperation({
    summary: "Delete a Feature",
    description: "This will delete a feature",
  })
  @ApiResponse({ status: 201, description: "Removed Feature Successfully" })
  @ApiResponse({ status: 400, description: "Failed to remove Feature" })
  @UseGuards(JwtAuthGuard)
  async deleteFeature(@Param("name") name: string, @Res() res: FastifyReply) {
    const feature = await this.featureService.deleteFeature(name);

    const responseData = new ApiResponseService(
      "Feature Removed",
      HttpStatusCode.OK,
      feature,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Retrieve all features.
   *
   * @param res - Fastify response object.
   */
  @Get("")
  @ApiOperation({
    summary: "Get All Feature",
    description: "This will retrieve All feature ",
  })
  @ApiResponse({
    status: 200,
    description: "Features Received Successfullt",
  })
  @ApiResponse({ status: 400, description: "Failed to fetch Feature" })
  async getAllFeature(@Res() res: FastifyReply) {
    const features = await this.featureService.getAllFeature();
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      features,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
