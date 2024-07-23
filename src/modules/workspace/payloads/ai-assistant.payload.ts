import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Data Transfer Object for generating ai response.
 */
export class PromptDto {
  /**
   * The prompt command.
   */
  @IsString()
  @ApiProperty({ required: true, example: "prompt" })
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: true, example: "thread id" })
  threadId: string;
}
