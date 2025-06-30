import { IsString, IsNotEmpty, IsOptional, IsNumber } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendSalesEmail {
  @ApiProperty({ required: true, example: "customer@gmail.com" })
  @IsString()
  @IsNotEmpty()
  customerEmail: string;

  @ApiProperty({ required: true, example: "User details need to be added" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: true, example: 4 })
  @IsNumber()
  @IsOptional()
  inviteCount?: number;

  @ApiProperty({ required: true, example: "User name" })
  @IsString()
  @IsOptional()
  customerFirstName?: string;

  @ApiProperty({ required: true, example: "techdome" })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({ required: true, example: "admin-credetianls" })
  @IsString()
  @IsNotEmpty()
  adminKey: string;
}
