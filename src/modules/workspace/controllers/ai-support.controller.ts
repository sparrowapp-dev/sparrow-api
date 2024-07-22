import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
import { AiSupportService } from "../services/ai-support.service";
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
import { PromptDto } from "../payloads/chat-ai.payload";

// @ApiBearerAuth()
@ApiTags("AI Support")
@Controller("api")
// @UseGuards(JwtAuthGuard)
export class AiSupportController {
  /**
   * Constructor to initialize AiSupportController with the required service.
   * @param aiSupportService - Injected AiSupportService to handle business logic.
   */
  constructor(private readonly aiSupportService: AiSupportService) {}

  @ApiOperation({
    summary: "Get a respose for chatbot",
    description: "this will return AI response from the prompt",
  })
  @ApiResponse({
    status: 201,
    description: "AI response Generated Successfully",
  })
  @ApiResponse({ status: 400, description: "Generate AI Response Failed" })
  @Post("chatbot/prompt")
  async generate(@Body() prompt: PromptDto, @Res() res: FastifyReply) {
    const data = await this.aiSupportService.generateText(
      prompt.text,
      prompt.threadId,
    );
    const response = new ApiResponseService(
      "Chatbot Reposonse Generated",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }
}
