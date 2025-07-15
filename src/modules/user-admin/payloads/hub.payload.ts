import { ApiProperty } from "@nestjs/swagger";
import { logoDto } from "@src/modules/identity/payloads/team.payload";
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateOrUpdateAdminHubDto {
  @ApiProperty({
    example: "team1",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "Description of Team",
  })
  @IsString()
  @IsOptional()
  description?: string;

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

  @IsBoolean()
  @IsOptional()
  firstTeam?: boolean;

  @IsOptional()
  @IsObject()
  logo?: logoDto;

  @ApiProperty({
    example: false,
  })
  @IsString()
  @IsOptional()
  isTrialHub?: string;

  @ApiProperty({
    example: "82348293489328",
  })
  @IsString()
  @IsOptional()
  trialId?: string;
}
