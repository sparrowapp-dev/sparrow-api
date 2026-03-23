import { Injectable, Logger } from "@nestjs/common";
import { UserMetricsRepository } from "../repositories/userMetrics.repository";

/**
 * UserMetrics Service
 * Provides event-driven methods to update user metrics.
 * All operations are fire-and-forget to avoid blocking the main request flow.
 */
@Injectable()
export class UserMetricsService {
  private readonly logger = new Logger(UserMetricsService.name);

  constructor(private readonly userMetricsRepository: UserMetricsRepository) {}

  /**
   * Track when a user creates an API endpoint.
   * Fire-and-forget: does not block the caller.
   *
   * @param userId The user who created the API
   */
  async onApiCreated(userId: string): Promise<void> {
    this.trackMetric(userId, { apisCreated: 1 }, "onApiCreated");
  }

  /**
   * Track when a user executes a testflow.
   * Fire-and-forget: does not block the caller.
   *
   * @param userId The user who executed the testflow
   */
  async onTestflowExecuted(userId: string): Promise<void> {
    this.trackMetric(userId, { testflowsExecuted: 1 }, "onTestflowExecuted");
  }

  /**
   * Track when a user creates a collection.
   * Fire-and-forget: does not block the caller.
   *
   * @param userId The user who created the collection
   */
  async onCollectionCreated(userId: string): Promise<void> {
    this.trackMetric(userId, { collectionsCount: 1 }, "onCollectionCreated");
  }

  /**
   * Track when a user is active in a workspace.
   * Fire-and-forget: does not block the caller.
   *
   * @param userId The user who was active in the workspace
   */
  async onWorkspaceActive(userId: string): Promise<void> {
    this.trackMetric(userId, { activeWorkspaces: 1 }, "onWorkspaceActive");
  }

  /**
   * Track general execution activity (updates, actions).
   * Fire-and-forget: does not block the caller.
   *
   * @param userId The user who performed the activity
   */
  async onExecutionActivity(userId: string): Promise<void> {
    this.trackMetric(userId, { totalExecutions: 1 }, "onExecutionActivity");
  }

  /**
   * Internal method to track a metric.
   * Wraps the repository call in try-catch to ensure non-blocking behavior.
   * Logs errors without throwing to avoid disrupting the main application flow.
   *
   * @param userId The user ID to track
   * @param payload The metrics to increment
   * @param eventName Name of the event for logging purposes
   */
  private trackMetric(
    userId: string,
    payload: {
      apisCreated?: number;
      testflowsExecuted?: number;
      collectionsCount?: number;
      activeWorkspaces?: number;
      totalExecutions?: number;
    },
    eventName: string,
  ): void {
    // Fire-and-forget: do not await
    this.incrementMetricsSafe(userId, payload, eventName);
  }

  /**
   * Safely increment metrics without blocking.
   * Catches and logs any errors.
   */
  private async incrementMetricsSafe(
    userId: string,
    payload: {
      apisCreated?: number;
      testflowsExecuted?: number;
      collectionsCount?: number;
      activeWorkspaces?: number;
      totalExecutions?: number;
    },
    eventName: string,
  ): Promise<void> {
    try {
      if (!userId) {
        return;
      }

      const weekStart = this.userMetricsRepository.getWeekStart();

      await this.userMetricsRepository.incrementMetrics(
        userId,
        weekStart,
        payload,
      );
    } catch (error) {
      // Log error but do not throw - this should never block the main flow
      this.logger.error(
        `Failed to track metric [${eventName}] for user ${userId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Batch track multiple events at once.
   * Useful for processing multiple activities in a single operation.
   *
   * @param operations Array of { userId, event } pairs
   */
  async trackBatch(
    operations: Array<{
      userId: string;
      event:
        | "apiCreated"
        | "testflowExecuted"
        | "collectionCreated"
        | "workspaceActive"
        | "executionActivity";
    }>,
  ): Promise<void> {
    try {
      if (operations.length === 0) {
        return;
      }

      const weekStart = this.userMetricsRepository.getWeekStart();

      const metricsOperations = operations.map(({ userId, event }) => {
        let payload: {
          apisCreated?: number;
          testflowsExecuted?: number;
          collectionsCount?: number;
          activeWorkspaces?: number;
          totalExecutions?: number;
        };

        switch (event) {
          case "apiCreated":
            payload = { apisCreated: 1 };
            break;
          case "testflowExecuted":
            payload = { testflowsExecuted: 1 };
            break;
          case "collectionCreated":
            payload = { collectionsCount: 1 };
            break;
          case "workspaceActive":
            payload = { activeWorkspaces: 1 };
            break;
          case "executionActivity":
            payload = { totalExecutions: 1 };
            break;
          default:
            payload = {};
        }

        return { userId, payload };
      });

      await this.userMetricsRepository.bulkIncrementMetrics(
        metricsOperations,
        weekStart,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track batch metrics: ${error.message}`,
        error.stack,
      );
    }
  }
}
