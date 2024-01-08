import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, MinLength } from "class-validator";

export class ResetPasswordPayload {
  @ApiProperty({
    required: true,
    example: "user@email.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class EarlyAccessPayload {
  @ApiProperty({
    required: true,
    example: "user@email.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyEmailPayload {
  @ApiProperty({
    example: "user@email.com",
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @ApiProperty({
    required: true,
    example: "ABC123",
  })
  @MinLength(6)
  @IsNotEmpty()
  verificationCode: string;
}
export class UpdatePasswordPayload {
  @ApiProperty({
    required: true,
    example: "user@email.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @ApiProperty({
    required: true,
    example: "newPassword",
  })
  @MinLength(8)
  @IsNotEmpty()
  newPassword: string;
}
