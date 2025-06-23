import { Body, Controller, Post, Req, Res, UseGuards, Get, Query, Delete, Put, Param } from "@nestjs/common";
import { ApiQuery, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { FastifyReply } from "fastify";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import {
  ApiBearerAuth,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { LlmConversation } from "../payloads/llm-conversation.payload";
import { LlmConversationService } from "../services/llm-conversation.service";

@ApiBearerAuth()
@ApiTags("AI Support")
@Controller("api/conversation")
@UseGuards(JwtAuthGuard)
export class LlmConversationController {
  /**
   * Constructor to initialize AiAssistantController with the required service.
   * @param llmConversationService - Injected LlmConversationService to handle LLM conversation logic.
   */
  constructor(private readonly llmConversationService: LlmConversationService) {}


  @Get("get-conversation")
  @ApiOperation({
      summary: "Get Conversation",
      description: "Get all Conversation from DB",
    })
  @ApiResponse({ status: 201, description: "Conversation Fetched" })
  @ApiResponse({ status: 400, description: "Failed to fetched conversation" })
  @ApiQuery({ name: 'provider', required: true })
  @ApiQuery({ name: 'apiKey', required: true })
  @ApiQuery({ name: 'id', required: false })
  async GetConversation(
    @Query("provider") provider: string,
    @Query("apiKey") apiKey: string,
    @Query("id") id: string,
    @Res() res: FastifyReply,
  ) {
    const data = await this.llmConversationService.getConversation(provider, apiKey, id);
    const response = new ApiResponseService(
      "Conversation fetched successfully",
      HttpStatusCode.OK,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Post("insert-conversation")
  @ApiOperation({
      summary: "Insert Conversation",
      description: "Insert Conversation in the DB",
    })
  @ApiResponse({ status: 201, description: "Conversation Inserted Successfully" })
  @ApiResponse({ status: 400, description: "Failed to inserted conversation" })
  async InsertConversation(@Body() payload: LlmConversation, @Res() res: FastifyReply) {
    const data = await this.llmConversationService.insertConversation(payload);
    const response = new ApiResponseService(
      "Conversation Inserted Successfully",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Put("update-conversation")
  @ApiOperation({
      summary: "Update Conversation",
      description: "Update Conversation in the DB",
    })
  @ApiResponse({ status: 201, description: "Conversation Update Successfully" })
  @ApiResponse({ status: 400, description: "Failed to update conversation" })
  async UpdateConversation(@Body() payload: LlmConversation, @Res() res: FastifyReply) {
    const data = await this.llmConversationService.updateConversation(payload);
    const response = new ApiResponseService(
      "Conversation Updated Successfully",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(response.httpStatusCode).send(response);
  }

  @Delete("delete-conversation/:id")
  @ApiOperation({
      summary: "Delete Conversation",
      description: "Delete Conversation from Conversation DB",
    })
  @ApiResponse({ status: 201, description: "Conversation Deleted Successfully" })
  @ApiResponse({ status: 400, description: "Failed to delete conversation" })
  @ApiQuery({ name: 'provider', required: true })
  @ApiQuery({ name: 'apiKey', required: true })
  async DeleteConversation(
    @Param("id") id: string,
    @Query("provider") provider: string,
    @Query("apiKey") apiKey: string,
    @Res() res: FastifyReply,
  ) {
    await this.llmConversationService.deleteConversation(provider, apiKey, id);
    const response = new ApiResponseService(
      "Conversation deleted successfully",
      HttpStatusCode.OK,
      null,
    );
    return res.status(response.httpStatusCode).send(response);
  }
}