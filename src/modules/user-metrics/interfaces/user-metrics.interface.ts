import { ObjectId } from "mongodb";

/**
 * Interface for user activity tracking
 */
export interface IUserActivity {
  _id?: ObjectId;
  userId: string;
  lastActiveAt: Date;
  requestCount: number;
  firstSeenAt: Date;
  environment: string;
}

/**
 * Interface for user metrics summary
 */
export interface IUserMetricsSummary {
  totalUniqueUsers: number;
  activeUsersLast24h: number;
  activeUsersLast7d: number;
  activeUsersLast30d: number;
  totalRequests: number;
  environment: string;
  timestamp: Date;
}

/**
 * Interface for user request tracking
 */
export interface IUserRequest {
  userId: string;
  method: string;
  origin: string;
  status: string;
  timestamp: Date;
  environment: string;
}

/**
 * Interface for time window configurations
 */
export interface ITimeWindow {
  name: string;
  durationMs: number;
}

/**
 * Interface for user metrics service methods
 */
export interface IUserMetricsService {
  trackUserActivity(
    userId: string,
    requestDetails: Partial<IUserRequest>,
  ): Promise<void>;
  getUniqueUserCount(): Promise<number>;
  getActiveUserCount(timeWindowMs: number): Promise<number>;
  getUserRequestCount(userId: string): Promise<number>;
  updateMetrics(): Promise<void>;
}
