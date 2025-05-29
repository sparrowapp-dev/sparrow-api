import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsMongoId, IsOptional, IsString } from "class-validator";
export class BillingAddressDto {
  @ApiProperty({
    example: "John Doe",
  })
  @IsString()
  name?: string;

  @IsString()
  email?: string;

  @IsString()
  address1?: string;

  @IsString()
  @IsOptional()
  address2?: string;

  @IsString()
  city?: string;

  @IsString()
  country?: string;

  @IsString()
  state?: string;

  @IsString()
  zipCode?: string;

  @IsArray()
  @IsOptional()
  customerId?: string[];
}
