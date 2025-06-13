import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
} from "class-validator";

export class CreateCustomerDto {
  @ApiProperty({
    description: "Customer email address",
    example: "customer@example.com",
  })
  @IsEmail()
  email: string;

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
    description: "The new Stripe price ID for the subscription",
    example: "price_67890",
  })
  @IsString()
  priceId: string;

  @IsString()
  paymentMethodId: string;

  @ApiPropertyOptional({
    description: "Additional metadata to update on the subscription",
    example: { planName: "Enterprise", userId: "12345" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
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
