import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  isISO8601,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Auth, KeyValue } from "./collection.rxdb.model";
import { AuthModeEnum, BodyModeEnum } from "./collection.model";
import { HTTPMethods } from "fastify";
import {
  DayOfWeek,
  NotificationReceiveType,
  RequestDataTypeEnum,
  RunCycleEnum,
} from "../enum/testflow.enum";

export class SparrowRequestBody {
  raw?: string;
  urlencoded?: KeyValue[];
  formdata?: FormData;
}

export class FormDataKeyValue {
  key: string;
  value: string | unknown;
  checked: boolean;
  type: "text" | "file";
}

interface FormData {
  text: FormDataKeyValue[];
}

export enum TestCaseModeEnum {
  NO_CODE = "no-code",
  SCRIPT = "script",
}

export enum TestCaseConditionOperatorEnum {
  EQUALS = "Equals",
  NOT_EQUAL = "Is Not Equal",
  EXISTS = "Exists",
  DOES_NOT_EXIST = "Does Not Exist",
  LESS_THAN = "Less Than",
  GREATER_THAN = "Greater Than",
  CONTAINS = "Contains",
  DOES_NOT_CONTAIN = "Does Not Contain",
  IS_EMPTY = "Is Empty",
  IS_NOT_EMPTY = "Is Not Empty",
  IN_LIST = "In List",
  NOT_IN_LIST = "Not In List",
}

export enum TestCaseSelectionTypeEnum {
  RESPONSE_TEXT = "Response Text",
  RESPONSE_JSON = "Response JSON",
  RESPONSE_HEADER = "Response Header",
  RESPONSE_XML = "Response XML",
  TIME_CONSUMING = "Time Consuming",
}

export class NoCodeTestCaseDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: TestCaseConditionOperatorEnum })
  @IsEnum(TestCaseConditionOperatorEnum)
  condition: TestCaseConditionOperatorEnum | "";

  @ApiProperty()
  @IsString()
  expectedResult: string;

  @ApiProperty()
  @IsString()
  testPath: string;

  @ApiProperty({ enum: TestCaseSelectionTypeEnum })
  @IsEnum(TestCaseSelectionTypeEnum)
  testTarget: TestCaseSelectionTypeEnum | "";
}

export class RequestTestCases {
  @ApiProperty({ enum: TestCaseModeEnum })
  @IsEnum(TestCaseModeEnum)
  testCaseMode: TestCaseModeEnum;

  @ApiProperty({ type: [NoCodeTestCaseDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoCodeTestCaseDto)
  noCode?: NoCodeTestCaseDto[];

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  script?: string;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  preScript?: string;
}

export class RequestMetaData {
  @ApiProperty({ example: "put" })
  @IsNotEmpty()
  method: HTTPMethods;

  @ApiProperty({ example: "pet" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "updatePet" })
  @IsString()
  @IsOptional()
  operationId?: string;

  @ApiProperty({ example: "/pet" })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ type: [SparrowRequestBody] })
  @Type(() => SparrowRequestBody)
  @ValidateNested({ each: true })
  @IsOptional()
  body?: SparrowRequestBody;

  @ApiProperty({
    enum: [
      "application/json",
      "application/xml",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "application/javascript",
      "text/plain",
      "text/html",
    ],
  })
  @IsEnum({ BodyModeEnum })
  @IsString()
  @IsOptional()
  selectedRequestBodyType?: BodyModeEnum;

  @ApiProperty({
    enum: AuthModeEnum,
  })
  @IsEnum({ AuthModeEnum })
  @IsString()
  @IsNotEmpty()
  selectedRequestAuthType?: AuthModeEnum;

  @ApiProperty({
    example: {
      name: "search",
      description: "The search term to filter results",
      required: false,
      schema: {},
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  queryParams?: KeyValue[];

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "userID",
      description: "The unique identifier of the user",
      required: true,
      schema: {},
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  pathParams?: KeyValue[];

  @ApiProperty({
    type: [KeyValue],
    example: {
      name: "Authorization",
      description: "Bearer token for authentication",
    },
  })
  @IsArray()
  @Type(() => KeyValue)
  @ValidateNested({ each: true })
  @IsOptional()
  headers?: KeyValue[];

  @ApiProperty({
    type: [Auth],
    example: {
      bearerToken: "Bearer xyz",
    },
  })
  @IsArray()
  @Type(() => Auth)
  @ValidateNested({ each: true })
  @IsOptional()
  auth?: Auth;

  @ApiProperty({ type: RequestTestCases })
  @IsOptional()
  @ValidateNested()
  @Type(() => RequestTestCases)
  tests?: RequestTestCases;
}

/**
 * Represents the edges of a Testflow which tell the connection between nodes.
 */
export class TestflowEdges {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsString()
  @IsNotEmpty()
  target: string;
}

/**
 * Represents the position of a node in a Testflow graph.
 */
export class NodePosition {
  @IsNumber()
  @IsNotEmpty()
  x: number;

  @IsNumber()
  @IsNotEmpty()
  y: number;
}

/**
 * Represents the data associated with a node in a Testflow like requestId.
 */
export class NodeData {
  @IsString()
  @IsNotEmpty()
  blockName: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  requestId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  folderId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  collectionId?: string;

  @ApiProperty({ type: RequestMetaData })
  @IsOptional()
  @Type(() => RequestMetaData)
  requestData?: RequestMetaData;
}

/**
 * Represents the nodes of the API blocks in a Testflow .
 */
export class TestflowNodes {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @Type(() => NodePosition)
  @IsOptional()
  position?: NodePosition;

  @Type(() => NodeData)
  @IsOptional()
  data?: NodeData;
}

// Main TestflowDataSet class
export class TestflowDataSet {
  @IsArray()
  @IsNotEmpty()
  dataSet: Record<string, string | number | boolean | null>[];
}

export enum FormatType {
  JSON = "JSON",
  CSV = "CSV",
}

export class TestflowDataSetItem {
  @IsString()
  @ApiProperty({ required: true, example: "uuid" })
  id: string;

  @IsString()
  @ApiProperty({ required: true, example: "testflow-dataset-name" })
  @IsNotEmpty()
  name: string;

  @ValidateNested()
  @Type(() => TestflowDataSet)
  item: TestflowDataSet;

  @IsString()
  @IsNotEmpty()
  formatType: FormatType;

  @IsString()
  @IsNotEmpty()
  fileSize: string;

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

export class TestflowDataSetItemDto {
  @IsArray()
  @IsNotEmpty()
  dataSet: Record<string, string | number | boolean | null>[];
}

export class TestflowDataSetDto {
  @ValidateNested()
  @Type(() => TestflowDataSetItemDto)
  item: TestflowDataSetItemDto;

  @IsString()
  @IsNotEmpty()
  formatType: FormatType;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: true, example: "testflow-dataset-name" })
  name: string;
}

/**
 * Represents a Testflow, containing nodes and edges.
 */
export class Testflow {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;

  @IsArray()
  @Type(() => TestflowEdges)
  @ValidateNested({ each: true })
  @IsOptional()
  edges: TestflowEdges[];

  @IsArray()
  @Type(() => TestflowNodes)
  @ValidateNested({ each: true })
  @IsOptional()
  nodes: TestflowNodes[];

  @IsArray()
  @Type(() => TestflowSchedular)
  @ValidateNested({ each: true })
  @IsOptional()
  schedules?: TestflowSchedular[];

  @IsArray()
  @Type(() => TestflowDataSetItem)
  @ValidateNested({ each: true })
  @IsOptional()
  datasets?: TestflowDataSetItem[];

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

/**
 * Represents a DTO containing brief information about a Testflow.
 */
export class TestflowInfoDto {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;
}

export class TestflowSchedularHistoryRequest {
  @IsString()
  @IsOptional()
  method?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  time: string;

  @IsString()
  @IsOptional()
  errorMessage?: string;

  @IsString()
  @IsOptional()
  error?: string;
}

export class TFKeyValueStoreDto {
  @IsString()
  key: string;

  @IsString()
  value: string;
}

export class TestflowSchedularHistoryResponse {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TFKeyValueStoreDto)
  headers: TFKeyValueStoreDto[];

  @IsString()
  status: string;

  @IsString()
  body: string;

  @IsNumber()
  time: number;

  @IsNumber()
  size: number;

  @IsOptional()
  @IsString()
  responseContentType?: RequestDataTypeEnum;
}

export class TestFlowSchedularRunHistory {
  @IsString()
  @ApiProperty({ required: true, example: "uuid" })
  id: string;

  @IsString()
  @IsNotEmpty()
  failedRequests: number;

  @IsBoolean()
  isScheduled: boolean;

  @IsArray()
  @IsOptional()
  requests?: TestflowSchedularHistoryRequest[];

  @IsArray()
  @IsOptional()
  responses?: TestflowSchedularHistoryResponse[];

  @IsArray()
  @Type(() => TestflowEdges)
  @ValidateNested({ each: true })
  @IsOptional()
  edges: TestflowEdges[];

  @IsArray()
  @Type(() => TestflowNodes)
  @ValidateNested({ each: true })
  @IsOptional()
  nodes: TestflowNodes[];

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsNumber()
  @IsNotEmpty()
  successRequests: number;

  @IsString()
  @IsNotEmpty()
  totalTime: string;

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

export class TestflowSchedularDataSetHistory {
  @IsString()
  @ApiProperty({ required: true, example: "uuid" })
  id: string;

  @IsArray()
  @Type(() => TestflowDataSetRunHistoryRequest)
  @ValidateNested({ each: true })
  @IsOptional()
  schedularDataRunHistory?: TestflowDataSetRunHistoryRequest[];

  @IsArray()
  @Type(() => TestflowEdges)
  @ValidateNested({ each: true })
  @IsOptional()
  edges?: TestflowEdges[];

  @IsArray()
  @Type(() => TestflowNodes)
  @ValidateNested({ each: true })
  @IsOptional()
  nodes?: TestflowNodes[];

  @IsBoolean()
  isScheduled: boolean;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

export class TestflowDataSetRunHistoryRequest {
  @IsString()
  @IsNotEmpty()
  failedRequests: number;

  @IsArray()
  @IsOptional()
  requests?: TestflowSchedularHistoryRequest[];

  @IsArray()
  @IsOptional()
  responses?: TestflowSchedularHistoryResponse[];

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsNumber()
  @IsNotEmpty()
  successRequests: number;

  @IsString()
  @IsNotEmpty()
  totalTime: string;
}

export class NotificationDto {
  @ApiProperty({
    required: false,
    example: ["user1@example.com", "user2@example.com"],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  emails: string[];

  @ApiProperty({
    required: true,
    example: true,
    description: "NotificationType",
  })
  @IsString()
  receiveNotifications: NotificationReceiveType;
}

export class RunConfigurationDto {
  @ApiProperty({
    required: true,
    enum: RunCycleEnum,
    example: RunCycleEnum.DAILY,
    description: "Type of run cycle",
  })
  @IsEnum(RunCycleEnum)
  runCycle: RunCycleEnum;

  // For ONCE type
  @ApiProperty({
    required: false,
    example: "2025-12-25T15:30:00.000Z",
    description:
      "ISO date string for one-time execution (required for ONCE type)",
  })
  @IsISO8601()
  @IsOptional()
  executeAt?: string;

  // For HOURLY type
  @ApiProperty({
    required: false,
    example: 2,
    minimum: 1,
    maximum: 24,
    description: "Interval in hours (required for HOURLY type)",
  })
  @IsInt()
  @Min(1)
  @Max(24)
  @IsOptional()
  intervalHours?: number;

  // For WEEKLY type
  @ApiProperty({
    required: false,
    example: [1, 3, 5], // Monday, Wednesday, Friday
    description:
      "Array of days (0=Sunday, 1=Monday, ..., 6=Saturday) - required for WEEKLY type",
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @IsOptional()
  days?: DayOfWeek[];

  // For DAILY, WEEKLY - specific time execution
  // For HOURLY - optional start time
  @ApiProperty({
    required: false,
    example: "14:30",
    description:
      "Time in HH:mm format - REQUIRED for DAILY (runs daily at this time), REQUIRED for WEEKLY (runs on selected days at this time), OPTIONAL for HOURLY (start time)",
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
      return value;
    }
    return value;
  })
  time?: string;
}

export class TestflowSchedular {
  @IsString()
  @ApiProperty({ required: true, example: "schedular-uuid" })
  id: string;

  @IsString()
  @ApiProperty({ required: true, example: "New Testflow Schedular Name" })
  @IsOptional()
  name: string;

  @IsString()
  @ApiProperty({ required: true, example: "New Testflow Schedular Name" })
  @IsOptional()
  environmentName: string;

  @IsString()
  @ApiProperty({ required: true, example: "428347384723" })
  @IsOptional()
  environmentId: string;

  @ApiProperty({
    required: true,
    type: () => RunConfigurationDto,
    example: {
      runCycle: "daily",
      every: "2h",
      date: "2025-09-23",
      time: "14:30",
      startTime: "09:00",
      endTime: "18:00",
    },
  })
  @ValidateNested()
  @Type(() => RunConfigurationDto)
  runConfiguration: RunConfigurationDto;

  @IsBoolean()
  @ApiProperty({ required: true, example: true })
  @IsOptional()
  isActive: boolean;

  @IsString()
  @IsOptional()
  testflowDataSetId?: string;

  @IsString()
  @IsOptional()
  testflowDataSetName?: string;

  @ApiProperty({
    required: false,
    type: () => NotificationDto,
    example: {
      emails: ["user1@example.com", "user2@example.com"],
      receiveNotifications: true,
    },
  })
  @ValidateNested()
  @Type(() => NotificationDto)
  notification?: NotificationDto;

  @IsNumber()
  @ApiProperty({ required: true, example: 1 })
  @IsOptional()
  executedCount?: number;

  @IsDate()
  @IsOptional()
  lastExecuted?: Date;

  @IsString()
  @ApiProperty({ required: true, example: "****" })
  @IsOptional()
  cronExpression?: string;

  @IsString()
  @ApiProperty({ required: true, example: "test" })
  @IsOptional()
  schedularName?: string;

  @IsArray()
  @Type(() => TestFlowSchedularRunHistory)
  @ValidateNested({ each: true })
  @IsOptional()
  schedularRunHistory?: TestFlowSchedularRunHistory[];

  @IsArray()
  @Type(() => TestflowSchedularDataSetHistory)
  @ValidateNested({ each: true })
  @IsOptional()
  schedularDataSetHistory?: TestflowSchedularDataSetHistory[];

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

export class RunScheduleTestDataSetDto {
  @IsString()
  @ApiProperty({ required: true, example: "uuid" })
  @IsOptional()
  testflowDataSetId?: string;
}
