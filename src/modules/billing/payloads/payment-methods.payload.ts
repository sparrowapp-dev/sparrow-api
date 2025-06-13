import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsEmail,
  IsOptional,
  IsObject,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class AddressDto {
  @ApiPropertyOptional({
    description: "Address line 1",
    example: "123 Main St",
  })
  @IsOptional()
  @IsString()
  line1?: string;

  @ApiPropertyOptional({ description: "Address line 2", example: "Apt 4B" })
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiPropertyOptional({ description: "City", example: "San Francisco" })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: "State/Province", example: "CA" })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: "Postal code", example: "94103" })
  @IsOptional()
  @IsString()
  postal_code?: string;

  @ApiPropertyOptional({ description: "Country code", example: "US" })
  @IsOptional()
  @IsString()
  country?: string;
}

export class UpdateBillingDetailsDto {
  @ApiPropertyOptional({ description: "Cardholder name", example: "John Doe" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: "Email address",
    example: "john@example.com",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: "Phone number", example: "+14155552671" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: "Billing address",
    type: AddressDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

export class CardDetailsDto {
  @ApiProperty({ description: "Card brand", example: "visa" })
  brand: string;

  @ApiProperty({ description: "Last 4 digits of card", example: "4242" })
  last4: string;

  @ApiProperty({ description: "Expiration month", example: 12 })
  exp_month: number;

  @ApiProperty({ description: "Expiration year", example: 2025 })
  exp_year: number;
}

export class PaymentMethodDto {
  @ApiProperty({ description: "Payment method ID", example: "pm_12345" })
  id: string;

  @ApiProperty({ description: "Payment method type", example: "card" })
  type: string;

  @ApiProperty({
    description: "Card details",
    type: CardDetailsDto,
  })
  card?: CardDetailsDto;

  @ApiProperty({
    description: "Billing details",
    example: {
      name: "John Doe",
      email: "john@example.com",
      phone: "+14155552671",
      address: {
        city: "San Francisco",
        country: "US",
        line1: "123 Market St",
        line2: "Apt 4B",
        postal_code: "94103",
        state: "CA",
      },
    },
  })
  billing_details: Record<string, any>;

  isDefault?: boolean;
}

export class PaymentMethodsResponseDto {
  @ApiProperty({
    description: "List of payment methods",
    type: [PaymentMethodDto],
  })
  paymentMethods: PaymentMethodDto[];
}

export class PaymentMethodResponseDto {
  @ApiProperty({
    description: "Payment method details",
    type: PaymentMethodDto,
  })
  paymentMethod: PaymentMethodDto;
}

export class DeletePaymentMethodResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: "Payment method detached successfully" })
  message: string;
}

export class SetDefaultPaymentMethodDto {
  @ApiProperty({
    description: "Customer ID",
    example: "cus_12345",
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: "Payment method ID to set as default",
    example: "pm_12345",
  })
  @IsString()
  paymentMethodId: string;
}
