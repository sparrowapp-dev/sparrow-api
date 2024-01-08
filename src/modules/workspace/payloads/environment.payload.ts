import {
  IsString,
  IsMongoId,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { VariableDto } from "@src/modules/common/models/environment.model";

export class CreateEnvironmentDto {
  @IsString()
  @ApiProperty({ required: true, example: "Environment name" })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: true, example: "6544cdea4b3d3b043a96c307" })
  @IsMongoId()
  @IsNotEmpty()
  @IsOptional()
  workspaceId?: string;

  @ApiProperty({
    required: true,
    example: [
      {
        key: "key",
        value: "value",
        checked: true,
      },
    ],
  })
  @IsArray()
  @Type(() => VariableDto)
  @ValidateNested({ each: true })
  variable: VariableDto[];
}

export class UpdateEnvironmentDto {
  @IsString()
  @ApiProperty({ required: true, example: "New environment name" })
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    required: false,
    example: [
      {
        key: "key",
        value: "value",
        checked: true,
      },
    ],
  })
  @IsArray()
  @Type(() => VariableDto)
  @ValidateNested({ each: true })
  @IsOptional()
  variable?: VariableDto[];
}
