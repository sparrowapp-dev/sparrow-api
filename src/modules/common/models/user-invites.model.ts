import { IsNotEmpty, IsString, IsArray, IsDateString } from "class-validator";

export class UserInvites {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsArray()
  @IsString({ each: true })
  teamIds: string[];

  @IsDateString()
  createdAt: Date;
}
