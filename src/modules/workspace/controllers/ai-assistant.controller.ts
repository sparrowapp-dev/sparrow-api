import { Body, Controller, Post, Req, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { AiAssistantService } from "../services/ai-assistant.service";
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
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
  ChatBotPayload,
} from "../payloads/ai-assistant.payload";
import { UserLimitGuard } from "@src/modules/identity/guards/user-limt-guard";
import { ExtendedFastifyRequest } from "@src/types/fastify";
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from "@blazity/nest-file-fastify";

@ApiBearerAuth()
@ApiTags("AI Support")
@Controller("api/assistant")
@UseGuards(JwtAuthGuard)
export class AiAssistantController {
  /**
   * Constructor to initialize AiAssistantController with the required service.
   * @param aiAssistantService - Injected AiAssistantService to handle business logic.
   * * @param llmConversationService - Injected LlmConversationService to handle LLM conversation logic.
   */
  constructor(private readonly aiAssistantService: AiAssistantService ) {}

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
  @UseGuards(UserLimitGuard)
  async generate(
    @Body() prompt: PromptPayload,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const data = await this.aiAssistantService.generateText(prompt, user);
    const response = new ApiResponseService(
      "AI Reposonse Generated",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Post("specific-error")
  async CurlError(
    @Body() errorResponse: ErrorResponsePayload,
    @Res() res: FastifyReply,
  ) {
    const data = await this.aiAssistantService.specificError(errorResponse);
    const response = new ApiResponseService(
      "AI Error Handler Reposonse Generated",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Post("generate-prompt")
  async GeneratePrompt(@Body() payload: ChatBotPayload, @Res() res: FastifyReply) {
    const data = await this.aiAssistantService.promptGeneration(payload);
    const response = new ApiResponseService(
      "Prompt Generated Successfully",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Upload document with model name',
    description: 'Uploads a document file and model name',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        doc: {
          type: 'string',
          format: 'binary',
        },
        model: {
          type: 'string',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('doc'))
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Upload failed' })
  async uploadDocWithModel(
    @UploadedFile() doc: MemoryStorageFile,
    @Body('model') model: string,
    @Body('authKey') authKey: string,
    @Req() req: ExtendedFastifyRequest,
    @Res() res: FastifyReply,
  ) {

    console.log("Document Uploaded: ", doc)
    console.log("Model: ", model)
    console.log("Auth Key: ", authKey)
     
    const result = await this.aiAssistantService.uploadDocumentWithModel(doc, model, authKey);

    // return res.status(201).send({
    //   message: 'Upload successful',
    //   data: result,
    // });
  }
}
