import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
} from "class-validator";

export class CreateCustomerDto {
  @ApiProperty({
    description: "Customer email address",
    example: "customer@example.com",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "Customer name",
    example: "John Doe",
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: "Additional metadata for the customer",
    example: { userId: "12345", companyName: "Acme Inc." },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class CustomerResponseDto {
  @ApiProperty({
    description: "The Stripe customer object",
    example: {
      id: "cus_12345",
      email: "customer@example.com",
      name: null,
      phone: null,
      created: 1622148000,
      metadata: { userId: "12345" },
    },
  })
  customer: Record<string, any>;
}

export class SetupIntentDto {
  @ApiProperty({
    description: "The Stripe customer ID",
    example: "cus_12345",
  })
  @IsString()
  customerId: string;
}

export class SetupIntentResponseDto {
  @ApiProperty({
    description: "Client secret used for Stripe Elements",
    example: "seti_12345_secret_67890",
  })
  clientSecret: string | null;
}

export class PublicKeyResponseDto {
  @ApiProperty({
    description: "Stripe publishable key",
    example: "pk_test_51JHy...",
  })
  publishableKey: string;
}

export class CreateSubscriptionDto {
  @ApiProperty({
    description: "The Stripe customer ID",
    example: "cus_12345",
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: "The Stripe price ID for the subscription",
    example: "price_12345",
  })
  @IsString()
  priceId: string;

  @ApiProperty({
    description: "The payment method ID to use for the subscription",
    example: "pm_12345",
  })
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: "Additional metadata for the subscription",
    example: { planName: "Pro", userId: "12345" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @ApiPropertyOptional({
    description: "Trial period in days (optional)",
    example: 14,
  })
  @IsOptional()
  @IsNumber()
  trialPeriodDays?: number;

  @ApiPropertyOptional({
    description: "Type of trial",
    examples: {
      standard: "standard",
      invited: "invited",
    },
  })
  @IsOptional()
  @IsString()
  trialType?: string;

  @ApiPropertyOptional({
    description:
      "Number of seats/quantity for the subscription (optional, defaults to 1)",
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  seats?: number;

  @ApiPropertyOptional({
    description: "Promo code ID to apply to the subscription (optional)",
    example: "promo_1RnwMrFLRwufXqZCfYOUbX3o",
  })
  @IsOptional()
  @IsString()
  promoCodeId?: string;
}

export class SubscriptionResponseDto {
  @ApiProperty({
    description: "The Stripe subscription object",
    example: {
      id: "sub_12345",
      status: "active",
      current_period_end: 1654684000,
      customer: "cus_12345",
      items: { data: [{ price: { id: "price_12345" } }] },
    },
  })
  subscription: Record<string, any>;
}

export class UpdateSubscriptionDto {
  @ApiProperty({
    description: "The new Stripe price ID for the subscription plan",
    example: "price_67890",
  })
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiPropertyOptional({
    description: "Payment method ID to use for this subscription",
    example: "pm_12345",
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: "Additional metadata for the subscription",
    example: { orderId: "12345", planName: "Premium" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @ApiPropertyOptional({
    description: "Proration behavior for subscription updates",
    example: "create_prorations",
    enum: ["create_prorations", "none", "always_invoice"],
  })
  @IsOptional()
  @IsString()
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";

  @ApiPropertyOptional({
    description: "Whether to apply changes at the end of the current period",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean;
  @IsOptional()
  @IsNumber()
  seats?: number;
  paymentBehavior?: "default_incomplete" | "allow_incomplete";
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: "Whether to cancel the subscription immediately",
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  cancelImmediately?: boolean;

  @ApiPropertyOptional({
    description: "team Id",
    example: "688731d965594536e3ffdce1",
  })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({
    description: "List of workspace IDs to downgrade",
    example: ["6889ff80b1338511b5bfc210"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workspaceIds?: string[];

  @ApiPropertyOptional({
    description: "List of user IDs to downgrade",
    example: ["example@gmail.com"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}

export class ReactivateSubscriptionDto {
  @ApiPropertyOptional({
    description: "Additional metadata to update on reactivation",
    example: { reactivationReason: "customer request" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class WebhookEventDto {
  @ApiProperty({
    description: "Stripe webhook event object",
  })
  @IsObject()
  event: Record<string, any>;
}
