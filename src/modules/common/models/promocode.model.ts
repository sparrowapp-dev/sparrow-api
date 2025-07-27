import {
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export enum PromoCodeType {
  PERCENTAGE = "percentage",
  AMOUNT = "amount",
}

export class PromoCodeProviderDto {
  @IsString()
  id: string;

  @IsString()
  provider: string;
}

export class PromoCodeDto {
  @IsString()
  @IsOptional()
  _id?: string;

  @IsString()
  code: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromoCodeProviderDto)
  promoCodeProvider: PromoCodeProviderDto[];

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

  @IsString({ each: true })
  @IsOptional()
  allowedUsers?: string[];

  @IsString()
  billingCycles: string | number;
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
