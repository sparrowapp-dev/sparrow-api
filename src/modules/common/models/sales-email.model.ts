import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class SalesEmail {
  @IsString()
  @IsNotEmpty()
  customerEmail: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsNotEmpty()
  isHubCreated: boolean;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsNumber()
  @IsOptional()
  inviteCount?: number;

  @IsString()
  @IsOptional()
  customerFirstName?: string;

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;
}
