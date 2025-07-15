import { KeyValue } from "@src/modules/common/models/collection.rxdb.model";
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class MockRequestResponseDto {
  @IsNumber()
  @IsNotEmpty()
  status: number;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsOptional()
  contentType?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  responseHeaders?: KeyValue[];
}
