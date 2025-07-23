import {
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";

export enum PromoCodeType {
  PERCENTAGE = "percentage",
  AMOUNT = "amount",
}

export class PromoCodeDto {
  @IsString()
  @IsOptional()
  _id?: string;

  @IsString()
  code: string;

  @IsString()
  stripePromoCodeId: string;

  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expiresAt?: Date;

  @IsString()
  duration: string;

  @IsEnum(PromoCodeType)
  type: PromoCodeType;

  @IsNumber()
  value: number;

  @IsString({ each: true })
  @IsOptional()
  applicableProducts?: string[];
}

export class CreatePromoCodeDto {
  @IsString()
  code: string;

  @IsEnum(PromoCodeType)
  type: PromoCodeType;

  @IsNumber()
  value: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString({ each: true })
  @IsOptional()
  applicableProducts?: string[];

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @IsNumber()
  @IsOptional()
  maxRedemptions?: number;

  @IsNumber()
  billingCycle: number;
}
