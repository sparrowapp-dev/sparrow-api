import {
  IsString,
  IsMongoId,
  IsOptional,
  IsNotEmpty,
  IsArray,
  IsEnum,
  ValidateNested,
  IsBoolean,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import {
  CollectionAuthModeEnum,
  CollectionItem,
  CollectionTypeEnum,
  ItemTypeEnum,
  QueryParams,
  RequestBody,
} from "@src/modules/common/models/collection.model";
import { HTTPMethods } from "fastify";
import { Type } from "class-transformer";
import { Auth } from "@src/modules/common/models/collection.rxdb.model";

export enum AddTo {
  Header = "Header",
  QueryParameter = "Query Parameter",
}
export class BasicAuthDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class ApiKeyDto {
  @IsString()
  authKey: string;

  @IsOptional()
  authValue: string | unknown;

  @IsString()
  addTo: AddTo; 
}

export class AuthContent {
  @ValidateNested()
  @IsOptional()
  @Type(() => BasicAuthDto)
  basicAuth?: BasicAuthDto;

  @IsString()
  @IsOptional()
  bearerToken?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => ApiKeyDto)
  apiKey?: ApiKeyDto;
}

export class AuthProfiles {
  @IsOptional()
  authId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CollectionAuthModeEnum)
  @IsOptional()
  authType?: CollectionAuthModeEnum;

  @IsOptional()
  createdAt?: Date;

  @IsBoolean()
  @IsOptional()
  defaultKey?: boolean;

  @ValidateNested()
  @Type(() => AuthContent)
  @IsOptional()
  auth?: AuthContent;
}

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

  @ApiProperty({
    enum: CollectionTypeEnum,
  })
  @IsEnum({ CollectionTypeEnum })
  @IsString()
  @IsOptional()
  collectionType?: CollectionTypeEnum;

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
  @IsOptional()
  name?: string;

  @ApiProperty({ example: "Its a mock description" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: CollectionAuthModeEnum,
  })
  @IsEnum({ CollectionAuthModeEnum })
  @IsString()
  @IsOptional()
  selectedAuthType?: CollectionAuthModeEnum;

  @ApiProperty({
    type: [Auth],
    example: {
      bearerToken: "Bearer xyz",
    },
  })
  @IsArray()
  @Type(() => AuthProfiles)
  @ValidateNested({ each: true })
  @IsOptional()
  auth?: AuthProfiles[];

  @ApiProperty({ type: [CollectionItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CollectionItem)
  items?: CollectionItem[];

  @ApiProperty({ example: "6544cdea4b3d3b043a96c307" })
  @IsString()
  @IsOptional()
  collectionId?: string;

}

export class UpdateMockCollectionStatusDto {
  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isMockCollectionRunning?: boolean;
}

export class ImportCollectionDto {
  @ApiProperty({
    required: true,
    example: "https://petstore.swagger.io/v2/swagger.json",
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    required: false,
    example: false,
  })
  @IsBoolean()
  activeSync?: boolean;

  @ApiProperty({ example: "C://users/github" })
  @IsString()
  @IsOptional()
  localRepositoryPath?: string;

  @ApiProperty({ example: "development" })
  @IsString()
  @IsOptional()
  primaryBranch?: string;

  @ApiProperty({ example: "feat/onboarding-v2" })
  @IsString()
  @IsOptional()
  currentBranch?: string;

  @ApiProperty()
  @IsOptional()
  urlData?: any;
}

export class SwitchCollectionBranchDto {
  @ApiProperty({ example: "feat/onboarding-v2" })
  @IsString()
  @IsNotEmpty()
  currentBranch: string;
}


export class authCollection {
  @ApiProperty({ required: true, example: "6544cdea4b3d3b043a96c307" })
  @IsMongoId()
  @IsNotEmpty()
  collectionId: string;

  @ApiProperty({ required: true, example: "6544cdea4b3d3b043a96c307" })
  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;

  @ApiProperty({ required: true, example: "6544cdea4b3d3b043a96c307" })
  @IsString()
  @IsNotEmpty()
  authId: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: "openai-conve-123" })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: "openai-conve-123" })
  description?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: "openai-conve-123" })
  authType?: CollectionAuthModeEnum;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ example: "openai-conve-123" })
  defaultKey?: boolean;

  @ValidateNested()
  @Type(() => AuthContent)
  @IsOptional()
  auth?: AuthContent;
}