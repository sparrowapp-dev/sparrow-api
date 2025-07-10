import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

// Providers for a billing option (e.g., Stripe, PayPal, etc.)
export class PricingPlanProviders {
  @IsString()
  @IsOptional()
  stripe?: string;
}

// Billing option for a plan (monthly, annual, etc.)
export class PricingPlanBilling {
  @IsString()
  @IsNotEmpty()
  interval: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsObject()
  @ValidateNested()
  @Type(() => PricingPlanProviders)
  providers: PricingPlanProviders;
}

// A single plan (Standard, Professional, etc.)
export class PricingPlan {
  @IsString()
  @IsNotEmpty()
  tier: string;

  @IsString()
  @IsNotEmpty()
  plan_name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingPlanBilling)
  billing: PricingPlanBilling[];
}

// The main pricing model
export class Pricing {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingPlan)
  plans: PricingPlan[];

  @IsNumber()
  @IsNotEmpty()
  version: number;

  @IsDateString()
  @IsNotEmpty()
  created_at: string;
}
