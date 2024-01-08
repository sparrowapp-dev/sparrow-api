import { Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";

export enum Env {
  DEV = "DEV",
  PROD = "PROD",
}

export class EnvironmentVariables {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  PORT: number;

  @IsString()
  @IsNotEmpty()
  @IsEnum(Env)
  APP_ENV: number;

  @IsString()
  @IsNotEmpty()
  APP_URL: number;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET_KEY: number;

  @Type(() => Number)
  @IsNumber()
  JWT_EXPIRATION_TIME: number;

  @IsString()
  @IsNotEmpty()
  DB_URL: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  GOOGLE_CLIENT_SECRET: string;

  @IsString()
  GOOGLE_APP_URL: string;

  @IsString()
  LOGIN_REDIRECT_URL: string;

  @IsString()
  GOOGLE_ACCESS_TYPE: string;

  @IsString()
  @IsNotEmpty()
  REFRESH_TOKEN_SECRET_KEY: string;

  @Type(() => Number)
  @IsNumber()
  REFRESH_TOKEN_EXPIRATION_TIME: number;

  @Type(() => Number)
  @IsNumber()
  REFRESH_TOKEN_MAX_LIMIT: number;

  @IsString()
  SENDER_EMAIL: string;

  @IsString()
  SENDER_PASSWORD: string;

  @Type(() => Number)
  @IsNumber()
  EMAIL_VALIDATION_CODE_EXPIRY_TIME: number;

  @IsString()
  @IsNotEmpty()
  KAFKA_BROKER: string;
}
