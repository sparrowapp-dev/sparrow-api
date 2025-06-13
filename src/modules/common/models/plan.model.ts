import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
} from "class-validator";

export enum LimitArea {
  USER = "user",
  HUB = "hub",
  WORKSPACE = "workspace",
  TESTFLOW = "testflow",
  BLOCK = "block",
  ENVIRONMENT = "environment",
  COLLECTION = "collection",
  TESTFLOW_RUNHISTORY = "testflow-run-history",
  AI = "ai",
}

export class WorkspaceLimit {
  area: LimitArea.WORKSPACE;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}

export class TestflowLimit {
  area: LimitArea.TESTFLOW;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}

export class BlocksPerTestflow {
  area: LimitArea.BLOCK;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}

export class UsersPerHub {
  area: LimitArea.HUB;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}

export class SelectiveTestflowRun {
  area: LimitArea.TESTFLOW;

  @IsBoolean()
  active: boolean;
}

export class AiRequestsPerMonth {
  area: LimitArea.AI;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}

export class ActiveSync {
  area: LimitArea.COLLECTION;

  @IsBoolean()
  active: boolean;
}
export class TestflowRunHistory {
  area: LimitArea.TESTFLOW_RUNHISTORY;

  @IsNumber()
  @IsNotEmpty()
  value: number;
}

export class Limits {
  workspacesPerHub: WorkspaceLimit;
  testflowPerWorkspace: TestflowLimit;
  blocksPerTestflow: BlocksPerTestflow;
  usersPerHub: UsersPerHub;
  selectiveTestflowRun: SelectiveTestflowRun;
  aiRequestsPerMonth: AiRequestsPerMonth;
  activeSync: ActiveSync;
  testflowRunHistory: TestflowRunHistory;
}

export class Plan {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsNotEmpty()
  active?: boolean;

  @IsNotEmpty()
  @IsObject()
  limits: Limits;

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;

  @IsString()
  createdBy: string;

  @IsString()
  updatedBy: string;
}
