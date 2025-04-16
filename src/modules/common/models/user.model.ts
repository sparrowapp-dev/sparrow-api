import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { TeamDto } from "./team.model";

export enum EmailServiceProvider {
  GMAIL = "GMAIL",
  OUTLOOK = "OUTLOOK",
}

export class EarlyAccessEmail {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;
}

export class TeamInvites {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsArray()
  @IsString()
  teamIds: string[];
}

export class User {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AuthProvider)
  authProviders?: AuthProvider[];

  @IsArray()
  @Type(() => TeamDto)
  @ValidateNested({ each: true })
  teams: TeamDto[];

  @ValidateNested()
  @Type(() => TeamInvites)
  @IsOptional()
  teamInvites?: TeamInvites;

  @IsArray()
  @Type(() => UserWorkspaceDto)
  @ValidateNested({ each: true })
  workspaces: UserWorkspaceDto[];

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;

  @IsArray()
  @IsString()
  @ArrayMaxSize(5)
  @IsOptional()
  refresh_tokens?: string[];

  @IsString()
  @MaxLength(6)
  @IsOptional()
  verificationCode?: string;

  @IsDate()
  @IsOptional()
  verificationCodeTimeStamp?: Date;

  @IsBoolean()
  @IsOptional()
  isVerificationCodeActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isEmailVerified?: boolean;

  @IsString()
  @MaxLength(6)
  @IsOptional()
  emailVerificationCode?: string;

  @IsDate()
  @IsOptional()
  emailVerificationCodeTimeStamp?: Date;

  @IsString()
  @MaxLength(6)
  @IsOptional()
  magicCode?: string;

  @IsDate()
  @IsOptional()
  magicCodeTimeStamp?: Date;

  @IsDate()
  @IsOptional()
  lastMagicCodeTimeStamp?: Date;

  @IsDate()
  @IsOptional()
  secondLastMagicCodeTimeStamp?: Date;

  @IsBoolean()
  @IsOptional()
  isUserAcceptedOccasionalUpdates?: boolean;

  @IsBoolean()
  @IsOptional()
  isCoolDownActive?: boolean;
}

export class UserDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  role: string;
}

class AuthProvider {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  oAuthId: string;
}

export class UserWorkspaceDto {
  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsMongoId()
  @IsNotEmpty()
  teamId: string;

  @IsBoolean()
  @IsOptional()
  isNewInvite?: boolean;
}
