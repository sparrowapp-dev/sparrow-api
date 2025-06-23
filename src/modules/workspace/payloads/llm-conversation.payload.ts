import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class UserConversationModel {
  /**
   * The message content.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ example: "hi" })
  message?: string;

  /**
   * ID of the message.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ example: "426e37bc-3c31-49c5-9d37-9a4b6ab12d8b" })
  messageId?: string;

  /**
   * Indicates the sender or receiver type.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ example: "Sender" })
  type?: string;

  /**
   * Indicates if the message was successfully processed.
   */
  @IsBoolean()
  @IsOptional()
  @ApiProperty({ example: true })
  status?: boolean;

  /**
   * The model provider (e.g., OpenAI).
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ example: "openai" })
  modelProvider?: string;

  /**
   * The variant of the model used (e.g., gpt-4o).
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ example: "gpt-4o" })
  modelVariant?: string;

  /**
   * HTTP-like status code from the model response.
   */
  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 200 })
  statusCode?: number;

  /**
   * Number of tokens sent to the model.
   */
  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 13 })
  inputTokens?: number;

  /**
   * Number of tokens received in response.
   */
  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 9 })
  outputTokens?: number;

  /**
   * Total number of tokens used in this message interaction.
   */
  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 22 })
  totalTokens?: number;

  /**
   * Processing time in milliseconds.
   */
  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 1272 })
  time?: number;
}

export class ConversationModel {
  /**
   * Unique identifier for this conversation.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ example: "unique-id" })
  id?: string;

  /**
   * Title of the conversation thread.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ example: "Welcome Chat" })
  title?: string;

  /**
   * Number of tokens sent to the model across the conversation.
   */
  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 120 })
  inputTokens?: number;

  /**
   * Number of tokens received from the model in total.
   */
  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 140 })
  outputTokens?: number;

  /**
   * Date when the conversation occurred.
   */
  @IsDateString()
  @IsOptional()
  @ApiProperty({ example: "2025-06-01" })
  date?: string;

  /**
   * Time when the conversation started or was last updated.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ example: "10:15" })
  time?: string;

  /**
   * Author or user who initiated the conversation.
   */
  @IsString()
  @IsOptional()
  @ApiProperty({ example: "user123" })
  authoredBy?: string;

  /**
   * Array of message entries in the conversation.
   */
  @IsOptional()
  @ApiProperty({ type: [UserConversationModel] })
  @Type(() => UserConversationModel)
  conversation?: UserConversationModel[];

}

export class LlmConversation {

  /**
   * The LLM provider.
   */
  @IsString()
  @ApiProperty({ example: "openai or gemini" })
  provider?: string;

  /**
   * Unique Id used to update the conversation.
   */
  @IsOptional()
  @IsString()
  @ApiProperty({ example: "openai-conve-123" })
  id?: string;

  /**
   * The API key used for the request.
   */
  @IsString()
  @ApiProperty({ example: "sk-openai-abc-123" })
  apiKey?: string;

  /**
   * Message entries in the conversation.
   */
  @IsOptional()
  @ApiProperty({ type: () => ConversationModel })
  @Type(() => ConversationModel)
  data?: ConversationModel;

}