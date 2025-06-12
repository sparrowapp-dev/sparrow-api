import { Injectable } from "@nestjs/common";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { Gauge, Counter } from "prom-client";

export interface UserMetricsData {
  totalUniqueUsers: number;
  activeUsers: number;
  environment: string;
  lastUpdated: Date;
}

export interface UserRequestData {
  userId: string;
  totalRequests: number;
  lastActivity: Date;
}

@Injectable()
export class UserMetricsService {
  constructor(
    @InjectMetric("unique_users_total") private readonly uniqueUsersGauge: Gauge<string>,
    @InjectMetric("user_requests_total") private readonly userRequestsCounter: Counter<string>,
    @InjectMetric("active_users_current") private readonly activeUsersGauge: Gauge<string>,
  ) {}

  /**
   * Get current user metrics summary
   */
  async getUserMetricsSummary(): Promise<UserMetricsData> {
    const environment = process.env.APP_ENV || "NA";
    
    // Get current metric values
    const uniqueUsersMetric = await this.uniqueUsersGauge.get();
    const activeUsersMetric = await this.activeUsersGauge.get();
    
    // Find the metric for current environment
    const uniqueUsersValue = uniqueUsersMetric.values.find(
      v => v.labels.environment === environment
    )?.value || 0;
    
    const activeUsersValue = activeUsersMetric.values.find(
      v => v.labels.environment === environment
    )?.value || 0;

    return {
      totalUniqueUsers: uniqueUsersValue,
      activeUsers: activeUsersValue,
      environment,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get user request statistics
   */
  async getUserRequestStats(): Promise<UserRequestData[]> {
    const userRequestsMetric = await this.userRequestsCounter.get();
    const userStats = new Map<string, { totalRequests: number; lastActivity: Date }>();

    // Aggregate requests by user
    for (const value of userRequestsMetric.values) {
      const userId = value.labels.user_id;
      if (userId) {
        // Ensure userId is a string
        const userIdStr = String(userId);
        const current = userStats.get(userIdStr) || { totalRequests: 0, lastActivity: new Date(0) };
        current.totalRequests += value.value;
        // Use current time as approximation since we don't store actual timestamps
        current.lastActivity = new Date();
        userStats.set(userIdStr, current);
      }
    }

    // Convert to array format
    return Array.from(userStats.entries()).map(([userId, stats]) => ({
      userId,
      totalRequests: stats.totalRequests,
      lastActivity: stats.lastActivity,
    }));
  }

  /**
   * Get top active users by request count
   */
  async getTopActiveUsers(limit: number = 10): Promise<UserRequestData[]> {
    const userStats = await this.getUserRequestStats();
    return userStats
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, limit);
  }

  /**
   * Reset user metrics (useful for testing or maintenance)
   * Note: This only resets the Prometheus metrics, not the in-memory tracking
   */
  async resetMetrics(): Promise<void> {
    const environment = process.env.APP_ENV || "NA";
    
    // Reset gauges to 0
    this.uniqueUsersGauge.set({ environment }, 0);
    this.activeUsersGauge.set({ environment }, 0);
    
    // Note: Counters cannot be reset in Prometheus, they only increase
    // To reset counters, you would need to restart the application
  }
}
