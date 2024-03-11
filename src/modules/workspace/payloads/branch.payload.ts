import { ApiProperty } from "@nestjs/swagger";
import { CollectionItem } from "@src/modules/common/models/collection.model";
import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsString, ValidateNested } from "class-validator";

export class createBranchDto {
  @IsString()
  @ApiProperty({ required: true, example: "Branch name" })
  @IsNotEmpty()
  name: string;

  @IsString()
  @ApiProperty({ required: true, example: "65ed7a82af45cb59f471a983" })
  @IsNotEmpty()
  collectionId: string;

  @ApiProperty({ type: [CollectionItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionItem)
  items: CollectionItem[];
}
