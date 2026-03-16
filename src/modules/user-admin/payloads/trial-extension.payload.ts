import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class ExtendTrialDto {
  @ApiProperty({ example: 30 })
  @IsNumber()
  @Min(1)
  extensionDays: number;

  @ApiProperty({ example: "Customer requested extension" })
  @IsString()
  reason: string;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  notifyCustomer?: boolean;
}
