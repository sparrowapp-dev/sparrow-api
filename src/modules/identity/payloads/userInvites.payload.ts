import { IsEmail, IsOptional, IsArray, IsString } from "class-validator";

export class CreateInviteUser {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsString({ each: true })
  teamIds: string[];
}

export class UpdateInviteUser {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsString({ each: true })
  teamIds: string[];
}
