import { IsEnum, IsMongoId, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// ---- Enum
import { UpdatesType } from "@src/modules/common/enum/updates.enum";

/**
 * Data transfer object (DTO) for adding updates.
 */
export class AddUpdateDto {
  /**
   * The type of updates (e.g., workspace, collection, role).
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsEnum(UpdatesType)
  type: UpdatesType;

  /**
   * Update message.
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  /**
   * workspace id where these update belong.
   */
  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;
}

export class GetUpdatesDto {
  /**
   * workspace id where these update belong.
   */
  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;

  /**
   * Page number for pagination to get the specific data .
   */
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  pageNumber: string;
}
