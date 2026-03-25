import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsBoolean, IsDateString } from "class-validator";

export class ChangePlanDto {
  @ApiProperty({ example: "69a57d17ce77429c5623abcb" })
  @IsString()
  currentPlanId: string;

  @ApiProperty({ example: "69a57d17ce77429c5623abcc" })
  @IsString()
  newPlanId: string;

  @ApiProperty({ example: "upgrade" })
  @IsString()
  changeType: string;

  @ApiProperty({ example: "2024-02-01" })
  @IsDateString()
  effectiveDate: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  prorate: boolean;
}
