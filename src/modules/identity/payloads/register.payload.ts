import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, MinLength, Matches } from "class-validator";

/**
 * Register Payload Class
 */
export class RegisterPayload {
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
  @Matches(/^[a-zA-Z ]+$/)
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
  @MinLength(8)
  password: string;
}
