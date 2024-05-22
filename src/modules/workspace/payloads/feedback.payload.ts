import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// ---- Enum
import {
  FeebackSubCategory,
  FeedbackType,
} from "@src/modules/common/enum/feedback.enum";

/**
 * Data transfer object (DTO) for adding feedback.
 */
export class AddFeedbackDto {
  /**
   * The type of feedback (e.g., suggestion, bug report).
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsEnum(FeedbackType)
  type: string;

  /**
   * The sub-category of the feedback (e.g., UI, functionality).
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsEnum(FeebackSubCategory)
  subCategory: string;

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
}
