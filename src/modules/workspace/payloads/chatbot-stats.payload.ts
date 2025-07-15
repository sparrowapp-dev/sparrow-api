import { ApiProperty } from "@nestjs/swagger";
import {
  ChatbotFeedback,
  TokenStats,
} from "@src/modules/common/models/chatbot-stats.model";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

/**
 * Data Transfer Object for updating response token.
 */
export class TokenDto {
  /**
   * The count of tokens used.
   */
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tokenCount: number;

  /**
   * The user ID associated with the token count, to which the token belongs to.
   */
  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  @IsString()
  userId: string;
  

  /**
   * The model used for generating the response.
   */
  @ApiProperty()
  @IsString() 
  @IsNotEmpty()
  model: string;

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


export class UpdateChatbotDto {
  /**
   * The count of tokens used.
   */
  @ApiProperty()
  @IsNumber()
  @IsOptional()
  tokenCount?: number;

  /**
   * The unique identifier of the user who interacted with the chatbot.
   * This field is required and must be a valid MongoDB ObjectId.
   */
  @ApiProperty()
  @IsMongoId()
  @IsOptional()
  @IsString()
  userId?: string;

  /**
   * An object holding the current month's token usage statistics.
   * This field is optional.
   */
  @ApiProperty({ type: TokenStats })
  @ValidateNested()
  @Type(() => TokenStats)
  @IsOptional()
  tokenStats?: TokenStats;

  /**
   * The unique identifier for the thread associated with the feedback.
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
}

export class ChatbotFeedbackDto {
  /**
   * The unique identifier for the thread associated with the feedback.
   * This field is optional.
   */
  @ApiProperty()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  threadId: string;

  /**
   * The unique identifier for the message associated with the feedback.
   * This field is optional.
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  messageId: string;

  /**
   * Whether the user liked the response or not.
   */
  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  like: boolean;
}
