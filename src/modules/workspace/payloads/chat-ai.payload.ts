import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

/**
 * Data Transfer Object for adding a new feature.
 *
 * This class defines the structure and validation rules for the data
 * required to add a new feature.
 */
export class PromptDto {
  /**
   * The prompt command.
   *
   * @example "Feature name"
   */
  @IsString()
  @ApiProperty({ required: true, example: "prompt" })
  @IsNotEmpty()
  text: string;
}
