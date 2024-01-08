import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, MinLength } from "class-validator";

/**
 * Login Paylaod Class
 */
export class LoginPayload {
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
   * Password field
   */
  @ApiProperty({
    required: true,
    example: "userpassword",
  })
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
