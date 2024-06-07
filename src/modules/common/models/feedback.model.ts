import {
  IsArray,
  IsDate,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { FeebackSubCategory, FeedbackType } from "../enum/feedback.enum";

/**
 * Feedback Files Model which contains uploaded file details
 */
export class FeedbackFiles {
  /**
   * The ID of the file.
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileId: string;

  /**
   * The name of the file.
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileName: string;

  /**
   * The URL of the file.
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  /**
   * The MIME type of the file.
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mimetype: string;
}

/**
 * Feedback Model
 */
export class Feedback {
  /**
   * The type of feedback (e.g., Bug, Feedback).
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsEnum(FeedbackType)
  type: string;

  /**
   * The sub-category of the feedback (e.g., Performance, Documentation).
   */
  @ApiProperty()
  @IsString()
  @IsOptional()
  @IsEnum(FeebackSubCategory)
  subCategory?: string;

  /**
   * The subject of the feedback (optional).
   */
  @ApiProperty()
  @IsString()
  @IsOptional()
  subject?: string;

  /**
   * The description of the feedback (optional).
   */
  @ApiProperty()
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Array of files associated with the feedback (optional).
   */
  @IsArray()
  @Type(() => FeedbackFiles)
  @ValidateNested({ each: true })
  @IsOptional()
  files?: FeedbackFiles[];

  /**
   * The creation date of the feedback (optional).
   */
  @IsDate()
  @IsOptional()
  createdAt?: Date;

  /**
   * The ID of the user who created the feedback (optional).
   */
  @IsString()
  @IsOptional()
  @IsMongoId()
  createdBy?: string;
}
