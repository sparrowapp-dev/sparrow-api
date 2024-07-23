import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Data Transfer Object for generating ai response.
 */
export class PromptPayload {
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

  @IsString()
  @IsOptional()
  @ApiProperty({ required: true, example: "instructions to your assistant" })
  instructions: string;
}

export class AIResponseDto {
  @ApiProperty({
    required: true,
    example: ["hii"],
  })
  @IsNotEmpty()
  result: string;

  @ApiProperty({
    required: true,
    example: "thread_34789",
  })
  @IsNotEmpty()
  threadId: string;
}
