import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AiAssistantService } from "../services/ai-assistant.service";
import { ApiConsumes, ApiBody } from "@nestjs/swagger";
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
  RequestGenerateMockDataDto,
  RequestTestScriptDataDto,
  generateTestCasesDto,
} from "../payloads/ai-assistant.payload";
import { UserLimitGuard } from "@src/modules/identity/guards/user-limt-guard";
import { ExtendedFastifyRequest } from "@src/types/fastify";
import {
  FilesInterceptor,
  MemoryStorageFile,
  UploadedFiles,
} from "@blazity/nest-file-fastify";

@ApiBearerAuth()
@ApiTags("AI Support")
@Controller("api/assistant")
export class AiAssistantController {
  /**
   * Constructor to initialize AiAssistantController with the required service.
   * @param aiAssistantService - Injected AiAssistantService to handle business logic.
   * * @param llmConversationService - Injected LlmConversationService to handle LLM conversation logic.
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
  @UseGuards(JwtAuthGuard, UserLimitGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard, UserLimitGuard)
  async GeneratePrompt(
    @Body() payload: ChatBotPayload,
    @Res() res: FastifyReply,
  ) {
    const data = await this.aiAssistantService.promptGeneration(payload);
    const response = new ApiResponseService(
      "Prompt Generated Successfully",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Post()
  @ApiOperation({
    summary: "Upload multiple documents with model name",
    description: "Uploads multiple document files and model name",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        docs: {
          type: "array",
          items: { type: "string", format: "binary" },
        },
        model: {
          type: "string",
        },
        authKey: {
          type: "string",
        },
        modelVersion: {
          type: "string",
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor("docs", 5))
  @ApiResponse({ status: 201, description: "Documents uploaded successfully" })
  @ApiResponse({ status: 400, description: "Upload failed" })
  async uploadDocWithModel(
    @UploadedFiles() docs: MemoryStorageFile[],
    @Body("model") model: string,
    @Body("authKey") authKey: string,
    @Body("modelVersion") modelVersion: string,
    @Res() res: FastifyReply,
  ) {
    const data = await this.aiAssistantService.uploadDocumentWithModel(
      docs,
      model,
      authKey,
      modelVersion,
    );
    const response = new ApiResponseService(
      "Documents Uploaded Successfully",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  /**
   * Generate Mock data for Request API for a specific type (headers, params, or body).
   *
   * @param requestData The request data which contains all the API request Details.
   * @param requestType The type of mock data to generate (e.g., headers, params, or body).
   * @returns The response object with status and generated mock data.
   */
  @Post("/generate-mock-data")
  @ApiOperation({
    summary: "Generate Mock Data for API request",
    description:
      "Generates mock data for a specific request type (headers, params, or body) based on the request definition.",
  })
  @UseGuards(JwtAuthGuard, UserLimitGuard)
  @ApiResponse({
    status: 200,
    description: "Generated Mock Data Successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Failed to generate mock data.",
  })
  @ApiResponse({
    status: 500,
    description: "Server failed to generate mock data.",
  })
  async generateMockDataForRequest(
    @Body() content: RequestGenerateMockDataDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const mockData = await this.aiAssistantService.generateMockData(
      user,
      content,
    );
    const responseData = new ApiResponseService(
      "Generated Mock Data Successfully",
      HttpStatusCode.OK,
      mockData,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("/fix-test-script")
  @ApiOperation({
    summary: "Fix Test Script for API request",
    description:
      "Fixes the test script for a specific request type (headers, params, or body) based on the request definition.",
  })
  @UseGuards(JwtAuthGuard, UserLimitGuard)
  @ApiResponse({
    status: 200,
    description: "Fixed Test Script Successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Failed to fix test script.",
  })
  @ApiResponse({
    status: 500,
    description: "Server failed to fix test script.",
  })
  async fixTestScriptForRequest(
    @Body() content: RequestTestScriptDataDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const mockData = await this.aiAssistantService.fixTestScript(user, content);
    const responseData = new ApiResponseService(
      "Fixed Test Script Successfully",
      HttpStatusCode.OK,
      mockData,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("/generate-test-cases")
  @ApiOperation({
    summary: "Generate Test Cases for API request",
    description:
      "Generates test cases for a specific request type (headers, params, or body) based on the request definition.",
  })
  @UseGuards(JwtAuthGuard, UserLimitGuard)
  @ApiResponse({
    status: 200,
    description: "Generated Test Cases Successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Failed to generate test cases.",
  })
  @ApiResponse({
    status: 500,
    description: "Server failed to generate test cases.",
  })
  async generateTestCasesForRequest(
    @Body() prompt: generateTestCasesDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const testCases = await this.aiAssistantService.generateTestCases(
      user,
      prompt,
    );
    const responseData = new ApiResponseService(
      "Generated Test Cases Successfully",
      HttpStatusCode.OK,
      testCases,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
