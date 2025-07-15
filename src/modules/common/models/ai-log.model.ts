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
 * AiLogs class is used to store statistics and feedback related to chatbot interactions.
 */
export class AiLogs {
  
  /**
   * The unique identifier of the user who interacted with the chatbot.
   * This field is required and must be a valid MongoDB ObjectId.
   */
  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  @IsString()
  userId: string;


  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  @IsString()
  activity: string;


  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  @IsString()
  model: string;

  /**
   * The total number of tokens consumed during the chatbot interaction.
   * This field is required.
   */
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tokenConsumed: number;

  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  @IsString()
  thread_id: string;

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

}