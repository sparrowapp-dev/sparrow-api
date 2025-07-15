import { ApiProperty } from "@nestjs/swagger";
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
  IsDate
} from "class-validator";


export class LogUpdateDTO {
  
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
  
}

/**
 * Data Transfer Object for updating response token.
 */
export class LogDTO {
  
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

}