import {
  IsDate,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { UpdatesType } from "../enum/updates.enum";

/**
 * The Updates class represents an update entity with various properties
 * validated using class-validator decorators.
 */
export class Updates {
  /**
   * The type of update, like it's belong to workspace, environment, folder etc.
   */
  @IsString()
  @IsEnum(UpdatesType)
  @IsNotEmpty()
  type: UpdatesType;

  /**
   * The message of the update. Must be a non-empty string.
   */
  @IsString()
  @IsNotEmpty()
  message: string;

  /**
   * The ID of the workspace whose update is this. Must be a valid MongoDB ObjectId and non-empty.
   */
  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;

  /**
   * The date when the update was created. Optional field.
   */
  @IsDate()
  @IsOptional()
  createdAt?: Date;

  /**
   * The ID of the user who created the update. Optional field.
   */
  @IsString()
  @IsOptional()
  createdBy?: string;

  /**
   * The ID of the user who last updated the details of the update. Optional field.
   */
  @IsString()
  @IsOptional()
  detailsUpdatedBy?: string;
}
