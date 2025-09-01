import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class CreateUserPayload {
  /**
   * Email field
   */
  @ApiProperty({
    required: true,
    example: "user@email.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  /**
   * Name field
   */
  @ApiProperty({
    required: true,
    example: "username",
  })
  @Matches(/^[a-zA-Z ]+$/, {
    message: "username only contain characters.",
  })
  @IsNotEmpty()
  name: string;

  /**
   * Password field
   */
  @ApiProperty({
    required: true,
    example: "userpassword",
  })
  @IsNotEmpty()
  @Matches(/(?=.*[0-9])/, {
    message: "password must contain at least one digit.",
  })
  @Matches(/(?=.*[!@#$%^&*])/, {
    message: "password must contain at least one special character (!@#$%^&*).",
  })
  @MinLength(8)
  password: string;
}
