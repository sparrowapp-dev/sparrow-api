import { IsString, IsNotEmpty, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Data Transfer Object for adding a new feature.
 *
 * This class defines the structure and validation rules for the data
 * required to add a new feature.
 */
export class AddFeatureDto {
  /**
   * The name of the feature.
   *
   * @example "Feature name"
   */
  @IsString()
  @ApiProperty({ required: true, example: "Feature name" })
  @IsNotEmpty()
  name: string;

  /**
   * Indicates if the feature is enabled.
   *
   * @example true
   */
  @IsBoolean()
  @ApiProperty({ required: true, example: true })
  @IsNotEmpty()
  isEnabled: boolean;
}

/**
 * Data Transfer Object for updating an existing feature.
 *
 * This class defines the structure and validation rules for the data
 * required to update an existing feature.
 */
export class UpdateFeatureDto {
  /**
   * Indicates if the feature is enabled.
   *
   * @example true
   */
  @IsBoolean()
  @ApiProperty({ required: true, example: true })
  @IsNotEmpty()
  isEnabled: boolean;
}
