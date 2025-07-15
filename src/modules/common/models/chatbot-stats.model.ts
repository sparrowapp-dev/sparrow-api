import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * ChatbotFeedback class is used to capture the feedback provided by users on chatbot messages.
 */
export class ChatbotFeedback {
  /**
   * The unique identifier for the thread associated with the feedback.
   * This field is optional.
   */
  @ApiProperty()
  @IsOptional()
  @IsString()
  threadId?: string;

  /**
   * The unique identifier for the message associated with the feedback.
   * This field is optional.
   */
  @ApiProperty()
  @IsOptional()
  @IsString()
  messageId?: string;

  /**
   * Indicates whether the user liked the chatbot message.
   * This field is optional.
   */
  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  like?: boolean;
}

/**
 * TokenStats class is used to store the monthly token usage of user.
 */
export class TokenStats {
  /**
   * The year and month for which the token usage is recorded.
   * Format: YYYY-MM (e.g., 2024-09).
   */
  @ApiProperty()
  @IsString()
  @IsOptional()
  yearMonth?: string;

  /**
   * The total number of tokens used during the specified year and month.
   */
  @ApiProperty()
  @IsNumber()
  @IsOptional()
  tokenUsage?: number;
}

/**
 * TokenUsageModel class is used to store the monthly token usage of user.
 */
export class TokenUsageModel {
  /**
   * The year and month for which the token usage is recorded.
   * Format: YYYY-MM (e.g., 2024-09).
   */
  @ApiProperty()
  @IsString()
  @IsOptional()
  yearMonth?: string;

  /**
   * The total number of GPT tokens used during the specified year and month.
  */
  @ApiProperty()
  @IsNumber()
  @IsOptional()
  'gpt'?: number;

  /**
   * The total number of Deep Seek tokens used during the specified year and month.
  */
  @ApiProperty()
  @IsNumber()
  @IsOptional()
  'deepseek'?: number;
}

/**
 * ChatBotStats class is used to store statistics and feedback related to chatbot interactions.
 */
export class ChatBotStats {
  /**
   * The total number of tokens consumed during the chatbot interaction.
   * This field is required.
   */
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tokenCount: number;

  /**
   * The unique identifier of the user who interacted with the chatbot.
   * This field is required and must be a valid MongoDB ObjectId.
   */
  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  @IsString()
  userId: string;

  /**
   * An object holding the current month's token usage statistics.
   * This field is optional.
   */
  @ApiProperty({ type: TokenStats })
  @Type(() => TokenStats)
  @IsOptional()
  tokenStats?: TokenStats;

  /**
   * An object holding the AI model used for the interaction.
   * This field is optional.
   */
  @ApiProperty({ type: TokenUsageModel })
  @Type(() => TokenUsageModel)
  @IsOptional()
  aiModel?: TokenUsageModel;


  /**
   * An array of feedback entries provided by users on chatbot messages.
   * This field is optional.
   */
  @ApiProperty({ type: [ChatbotFeedback] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatbotFeedback)
  @IsOptional()
  feedback?: ChatbotFeedback[];

  /**
   * The date and time when the chatbot statistics were created.
   * This field is optional.
   */
  @IsDate()
  @IsOptional()
  createdAt?: Date;

  /**
   * The identifier of the user who created the chatbot statistics.
   * This field is optional.
   */
  @IsString()
  @IsOptional()
  createdBy?: string;

  /**
   * The date and time when the chatbot statistics were last updated.
   * This field is optional.
   */
  @IsDate()
  @IsOptional()
  updatedAt?: Date;

  /**
   * The identifier of the user who last updated the chatbot statistics.
   * This field is optional.
   */
  @IsString()
  @IsOptional()
  updatedBy?: string;
}
