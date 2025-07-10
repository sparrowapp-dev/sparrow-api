import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

// ---- Fastify
import { FastifyReply } from "fastify";

// ---- Guard
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";

// ---- Enum
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

// ---- Services
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { PricingService } from "../services/pricing.repository";

/**
 * Pricing Controller
 */
@ApiBearerAuth()
@ApiTags("pricing")
@Controller("api/pricing") // Base route for this controller
@UseGuards(JwtAuthGuard) // JWT authentication guard to protect routes
export class PricingController {
  /**
   * Constructor to initialize PricingController with the required service.
   */
  constructor(private readonly pricingServie: PricingService) {}

  /**
   * Fetches updates for a specific workspace in batches of 20.
   *
   * @param workspaceId - The ID of the workspace to fetch updates for.
   * @param pageNumber - The page number of the updates batch to retrieve.
   * @param res - Fastify reply object for sending the response.
   * @returns A Fastify response with the updates or an error message.
   */
  @Get("")
  @ApiOperation({
    summary: "Get the Pricing Details",
    description: "You can fetch the latest pricing details",
  }) // Provides metadata for this operation in Swagger documentation
  @ApiResponse({
    status: 201,
    description: "Pricing received succcessfully",
  })
  @ApiResponse({ status: 400, description: "Failed to retrieve pricing" })
  async getPricing(@Res() res: FastifyReply) {
    const pricing = await this.pricingServie.getpricingDetails(); // Calls the pricing service to get the pricing details
    const responseData = new ApiResponseService(
      "Pricing received",
      HttpStatusCode.CREATED,
      pricing,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
