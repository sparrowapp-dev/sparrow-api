import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

/**
 * UserMetrics model for precomputed weekly digest metrics.
 * Designed for efficient upserts and bulk reads without aggregation.
 */
export class UserMetrics {
  /**
   * The user ID this metric belongs to. Indexed for fast lookups.
   */
  @IsString()
  @IsNotEmpty()
  userId: string;

  /**
   * The start of the week (Monday 00:00:00 UTC) this metric covers.
   * Combined with userId for compound index.
   */
  @IsDate()
  @IsNotEmpty()
  weekStart: Date;

  /**
   * Total number of executions (updates/activities) by the user this week.
   */
  @IsNumber()
  @IsOptional()
  totalExecutions?: number;

  /**
   * Number of APIs created by the user this week.
   */
  @IsNumber()
  @IsOptional()
  apisCreated?: number;

  /**
   * Number of collections the user has access to.
   */
  @IsNumber()
  @IsOptional()
  collectionsCount?: number;

  /**
   * Number of active workspaces the user participated in this week.
   */
  @IsNumber()
  @IsOptional()
  activeWorkspaces?: number;

  /**
   * Number of testflows executed by the user this week.
   */
  @IsNumber()
  @IsOptional()
  testflowsExecuted?: number;

  /**
   * Timestamp when this metric was last updated.
   */
  @IsDate()
  @IsOptional()
  updatedAt?: Date;
}

/**
 * Payload for incrementing metrics. All fields are optional
 * since we use $inc for partial updates.
 */
export interface IncrementMetricsPayload {
  totalExecutions?: number;
  apisCreated?: number;
  collectionsCount?: number;
  activeWorkspaces?: number;
  testflowsExecuted?: number;
}

/**
 * Metrics data returned from the repository.
 */
export interface UserMetricsData {
  userId: string;
  weekStart: Date;
  totalExecutions: number;
  apisCreated: number;
  collectionsCount: number;
  activeWorkspaces: number;
  testflowsExecuted: number;
  updatedAt: Date;
}
