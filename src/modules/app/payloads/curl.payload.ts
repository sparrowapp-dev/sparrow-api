import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class curlDto {
  @ApiProperty({
    example: "curl google.com",
  })
  @IsString()
  @IsNotEmpty()
  curl: string;
}
