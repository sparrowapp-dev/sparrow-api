import { Type } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
} from "class-validator";

export enum Env {
  DEV = "DEV",
  PROD = "PROD",
}

export enum AppEdition {
  SELFHOSTED = "SELFHOSTED",
  MANAGED = "MANAGED",
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
  REFRESH_TOKEN_SECRET_KEY: string;

  @Type(() => Number)
  @IsNumber()
  REFRESH_TOKEN_EXPIRATION_TIME: number;

  @Type(() => Number)
  @IsNumber()
  REFRESH_TOKEN_MAX_LIMIT: number;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  SELF_HOST_ADMIN_EMAIL: string;

  @IsString()
  @IsNotEmpty()
  SELF_HOST_ADMIN_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(AppEdition)
  APP_EDITION: string;
}
