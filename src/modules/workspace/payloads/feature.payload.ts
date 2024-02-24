import { IsString, IsNotEmpty, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddFeatureDto {
  @IsString()
  @ApiProperty({ required: true, example: "Feature name" })
  @IsNotEmpty()
  name: string;
}

export class UpdateFeatureDto {
  @IsBoolean()
  @ApiProperty({ required: true, example: true })
  @IsNotEmpty()
  isEnabled: boolean;
}
