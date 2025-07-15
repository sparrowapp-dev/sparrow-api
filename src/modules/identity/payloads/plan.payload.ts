import { Limits, Plan } from "@src/modules/common/models/plan.model";
import {
  IsBoolean,
  IsMongoId,
  isNotEmpty,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import { ObjectId } from "mongodb";

export class CreateOrUpdatePlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;


  @IsBoolean()
  @IsNotEmpty()
  active: boolean;

  @IsObject()
  @IsNotEmpty()
  limits: Limits;
}

export class PlanDto extends Plan {
  @IsMongoId()
  id: ObjectId;
}
