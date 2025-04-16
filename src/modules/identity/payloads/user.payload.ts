import { ApiProperty } from "@nestjs/swagger";
import { TeamDto } from "@src/modules/common/models/team.model";
import {
  TeamInvites,
  UserWorkspaceDto,
} from "@src/modules/common/models/user.model";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
  // ValidateNested,
} from "class-validator";

export class UpdateUserDto {
  /**
   * Name field
   */
  @ApiProperty({
    required: true,
    example: "username",
  })
  @Matches(/^[a-zA-Z ]+$/)
  @IsNotEmpty()
  name: string;
}

export class UserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsOptional()
  @Type(() => TeamDto)
  teams?: TeamDto[];

  @IsArray()
  @Type(() => UserWorkspaceDto)
  @IsOptional()
  @ValidateNested({ each: true })
  workspaces?: UserWorkspaceDto[];

  @ValidateNested()
  @Type(() => TeamInvites)
  @IsOptional()
  teamInvites?: TeamInvites;
}

export class RegisteredWith {
  @IsString()
  registeredWith: string;
}

/**
 * Payload for sending a Magic Code email.
 */
export class EmailPayload {
  /**
   * The email address to which the Magic Code should be sent.
   * @example "user@email.com"
   */
  @ApiProperty({
    required: true,
    example: "user@email.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

/**
 * Payload for verifying the Magic Code sent to the user's email.
 * Extends the `EmailPayload` to include the Magic Code.
 */
export class VerifyMagiCodePayload extends EmailPayload {
  /**
   * The Magic Code to be verified.
   * @example "ABC123"
   */
  @ApiProperty({
    required: true,
    example: "ABC123",
  })
  @MinLength(6)
  @IsNotEmpty()
  magicCode: string;
}

export class OccaisonalUpdatesPayload extends EmailPayload {
  /**
   * The occaisonal uodates status.
   * @example true
   */
  @ApiProperty({
    required: true,
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  isUserAcceptedOccasionalUpdates: boolean;
}
