import { IsNumber, IsDate, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class LicensesDto {
  @IsNumber()
  @IsOptional()
  totalSeats?: number;

  @IsNumber()
  @IsOptional()
  usedSeats?: number;

  @IsNumber()
  @IsOptional()
  availableSeats?: number;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  lastUpdated?: Date;
}
