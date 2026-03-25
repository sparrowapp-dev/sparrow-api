import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsDateString } from "class-validator";

export class AddPlanDto {
  @ApiProperty({ example: "premium_plan_123" })
  @IsString()
  planId: string;

  @ApiProperty({ example: "2024-01-15" })
  @IsDateString()
  effectiveDate: string;

  @ApiProperty({ example: "monthly" })
  @IsString()
  billingCycle: string;

  @ApiProperty({ example: "Adding premium features" })
  @IsOptional()
  @IsString()
  notes?: string;
}
