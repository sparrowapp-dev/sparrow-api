// ---- NestJS Native imports
import { Body, Controller, Post, Req, Res, UseGuards } from "@nestjs/common";

// ---- Fastify
import { FastifyReply } from "fastify";

// ---- Swagger
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

// ---- Enums
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

// ---- Services
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { ChatbotStatsService } from "../services/chatbot-stats.service";

// ---- Guard
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";

// ---- Payload
import { ChatbotFeedbackDto } from "../payloads/chatbot-stats.payload";
import { ExtendedFastifyRequest } from "@src/types/fastify";

/**
 * ChatbotStatsController handles API endpoints related to chatbot statistics and feedback.
 * It uses JWT authentication for security and integrates with Fastify for response handling.
 */
@ApiBearerAuth()
@ApiTags("Chatbot Stats")
@Controller("api/chatbotstats")
@UseGuards(JwtAuthGuard)
export class ChatbotStatsController {
  /**
   * Constructor to initialize ChatbotStatsController with the required service.
   * @param chatbotStatsController - Injected ChatbotStatsController to handle business logic.
   */
  constructor(private readonly chatbotStatsService: ChatbotStatsService) {}

  /**
   * Endpoint to add or update feedback for AI-generated responses.
   * @param payload - The feedback data to be added or updated.
   * @param res - The Fastify reply object.
   * @returns A response with the status and message indicating the result of the operation.
   */
  @ApiOperation({
    summary: "Add a feedback for AI generated response",
    description:
      "This will update or add the feedback for the AI generated response",
  })
  @ApiResponse({
    status: 201,
    description: "Feedback Added Successfully",
  })
  @ApiResponse({ status: 400, description: "Failed to add feedback" })
  @Post("feedback")
  async updateFeedback(
    @Body() payload: ChatbotFeedbackDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const data = await this.chatbotStatsService.updateFeedback(
      payload,
      user._id,
    );
    const response = new ApiResponseService(
      "AI Feedack updates",
      HttpStatusCode.OK,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }
}
