import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
import { AiAssistantService } from "../services/ai-assistant.service";
import { FastifyReply } from "fastify";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import {
  PromptPayload,
  ErrorResponsePayload,
} from "../payloads/ai-assistant.payload";

@ApiBearerAuth()
@ApiTags("AI Support")
@Controller("api/assistant")
@UseGuards(JwtAuthGuard)
export class AiAssistantController {
  /**
   * Constructor to initialize AiAssistantController with the required service.
   * @param aiAssistantService - Injected AiAssistantService to handle business logic.
   */
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @ApiOperation({
    summary: "Get a respose for AI assistant",
    description: "this will return AI response from the input prompt",
  })
  @ApiResponse({
    status: 201,
    description: "AI response Generated Successfully",
  })
  @ApiResponse({ status: 400, description: "Generate AI Response Failed" })
  @Post("prompt")
  async generate(@Body() prompt: PromptPayload, @Res() res: FastifyReply) {
    const data = await this.aiAssistantService.generateText(prompt);
    const response = new ApiResponseService(
      "AI Reposonse Generated",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Post("specific-error")
  async CurlError(
    @Body() text: ErrorResponsePayload,
    @Res() res: FastifyReply,
  ) {
    const data = await this.aiAssistantService.specificError(text);
    const response = new ApiResponseService(
      "AI Reposonse Generated",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }
}
