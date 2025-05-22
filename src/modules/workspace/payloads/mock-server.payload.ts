import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class MockRequestResponseDto {
  @IsNumber()
  @IsNotEmpty()
  status: number;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsOptional()
  contentType?: string;
}
