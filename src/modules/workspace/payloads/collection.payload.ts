import {
  IsString,
  IsMongoId,
  IsOptional,
  IsNotEmpty,
  IsArray,
  IsEnum,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import {
  CollectionItem,
  ItemTypeEnum,
  QueryParams,
  RequestBody,
} from "@src/modules/common/models/collection.model";
import { HTTPMethods } from "fastify";
import { Type } from "class-transformer";

export class collectionItemsRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  method: HTTPMethods;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  url: string;

  @ValidateNested({ each: true })
  @Type(() => RequestBody)
  @ApiProperty({ type: RequestBody })
  @IsOptional()
  body?: RequestBody;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueryParams)
  @IsOptional()
  @ApiProperty({ isArray: true, type: QueryParams })
  queryParams?: QueryParams[];
}

export class createCollectionItemsDto {
  @IsNotEmpty()
  @ApiProperty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @ApiProperty()
  @IsEnum(ItemTypeEnum)
  type: ItemTypeEnum;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => createCollectionItemsDto)
  @ApiProperty({ isArray: true, type: createCollectionItemsDto })
  @IsOptional()
  items?: createCollectionItemsDto[];

  @ValidateNested({ each: true })
  @Type(() => collectionItemsRequestDto)
  @ApiProperty({ type: collectionItemsRequestDto })
  @IsOptional()
  request?: collectionItemsRequestDto;
}
export class CreateCollectionDto {
  @IsString()
  @ApiProperty({ required: true, example: "Swagger Petstore - OpenAPI 3.0" })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: true, example: "6544cdea4b3d3b043a96c307" })
  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;

  @ApiProperty({ type: [CollectionItem] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CollectionItem)
  items?: CollectionItem[];
}

export class UpdateCollectionDto {
  @ApiProperty({ example: "Swagger Petstore - OpenAPI 3.0" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: [CollectionItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CollectionItem)
  items?: CollectionItem[];
}

export class ImportCollectionDto {
  @ApiProperty({
    required: true,
    example: "https://petstore.swagger.io/v2/swagger.json",
  })
  @IsString()
  @IsNotEmpty()
  url: string;
}
