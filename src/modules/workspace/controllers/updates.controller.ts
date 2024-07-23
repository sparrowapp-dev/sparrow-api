import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
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
import { UpdatesService } from "../services/updates.service";

/**
 * Updates Controller
 */
@ApiBearerAuth()
@ApiTags("updates")
@Controller("api/updates") // Base route for this controller
@UseGuards(JwtAuthGuard) // JWT authentication guard to protect routes
export class UpdatesController {
  /**
   * Constructor to initialize UpdatesController with the required service.
   * @param updatesService - Injected UpdatesService to handle business logic.
   */
  constructor(private readonly updatesServie: UpdatesService) {}

  /**
   * Fetches updates for a specific workspace in batches of 20.
   *
   * @param workspaceId - The ID of the workspace to fetch updates for.
   * @param pageNumber - The page number of the updates batch to retrieve.
   * @param res - Fastify reply object for sending the response.
   * @returns A Fastify response with the updates or an error message.
   */
  @Get(":workspaceId/page/:pageNumber")
  @ApiOperation({
    summary: "Get the Updates",
    description: "You can fetch specific workspace updates on a batch of 20",
  }) // Provides metadata for this operation in Swagger documentation
  @ApiResponse({
    status: 201,
    description: "Workspace updates received succcessfully",
  })
  @ApiResponse({ status: 400, description: "Failed to retrieve updates" })
  async getUpdates(
    @Param("workspaceId") workspaceId: string,
    @Param("pageNumber") pageNumber: string,
    @Res() res: FastifyReply,
  ) {
    const updates = await this.updatesServie.findUpdatesByWorkspace(
      workspaceId,
      pageNumber,
    ); // Calls the updates service to get the updates
    const responseData = new ApiResponseService(
      "Updates received",
      HttpStatusCode.CREATED,
      updates,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
