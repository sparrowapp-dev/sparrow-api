import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { WorkspaceDto } from "./workspace.model";
import { Type } from "class-transformer";
import { UserDto } from "./user.model";
import { ObjectId } from "mongodb";
import { SelectedWorkspaces } from "@src/modules/identity/payloads/teamUser.payload";

export class logoDto {
  @IsString()
  @IsOptional()
  bufferString?: string;

  @IsString()
  @IsOptional()
  encoding?: string;

  @IsString()
  @IsOptional()
  mimetype?: string;

  @IsNumber()
  @IsOptional()
  size?: number;
}

export class Plan {
  @IsMongoId()
  id: ObjectId;

  @IsString()
  name: string;
}

export class Team {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNotEmpty()
  plan: Plan;

  @IsString()
  @IsOptional()
  hubUrl?: string;

  @IsString()
  @IsOptional()
  githubUrl?: string;

  @IsString()
  @IsOptional()
  xUrl?: string;

  @IsString()
  @IsOptional()
  linkedinUrl?: string;

  @IsOptional()
  @IsObject()
  logo?: logoDto;

  @IsArray()
  @Type(() => WorkspaceDto)
  @ValidateNested({ each: true })
  @IsOptional()
  workspaces?: WorkspaceDto[];

  @IsArray()
  @Type(() => UserDto)
  @ValidateNested({ each: true })
  users: UserDto[];

  @IsArray()
  @IsNotEmpty()
  owner: string;

  @IsArray()
  @IsOptional()
  admins?: string[];

  @IsArray()
  @IsOptional()
  invites?: Invite[];

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

export class TeamWithNewInviteTag extends Team {
  @IsBoolean()
  @IsOptional()
  isNewInvite?: boolean;
}

export class TeamDto {
  @IsMongoId()
  @IsNotEmpty()
  id: ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsBoolean()
  @IsOptional()
  isNewInvite?: boolean;

  @IsOptional()
  @IsDate()
  joinedAt?: Date;
}

export class Invite {
  @IsUUID()
  @IsNotEmpty()
  inviteId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  role?: string;

  @IsArray()
  @Type(() => SelectedWorkspaces)
  @ValidateNested({ each: true })
  workspaces?: SelectedWorkspaces[];

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;

  @IsMongoId()
  @IsOptional()
  createdBy?: ObjectId;

  @IsMongoId()
  @IsOptional()
  updatedBy?: ObjectId;

  @IsDateString()
  @Type(() => Date)
  @IsNotEmpty()
  expiresAt: Date;

  @IsBoolean()
  @IsNotEmpty()
  isAccepted: boolean;
}
