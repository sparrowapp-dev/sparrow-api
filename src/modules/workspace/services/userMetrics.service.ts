import { Injectable, Logger } from "@nestjs/common";
import { UserMetricsRepository } from "../repositories/userMetrics.repository";
import { UserMetricsBufferService } from "./userMetricsBuffer.service";

/**
 * UserMetrics Service
 * Provides event-driven methods to update user metrics.
 * All operations are fire-and-forget to avoid blocking the main request flow.
 */
@Injectable()
export class UserMetricsService {
  private readonly logger = new Logger(UserMetricsService.name);

  constructor(
    private readonly userMetricsRepository: UserMetricsRepository,
    private readonly userMetricsBufferService: UserMetricsBufferService,
  ) {}

  /**
   * Track when a user creates an API endpoint.
   * Fire-and-forget: does not block the caller.
   *
   * @param userId The user who created the API
   */
  async onApiCreated(userId: string): Promise<void> {
    this.logger.log(`Metrics update: API created for ${userId}`);
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
    this.logger.log(`Metrics update: Collection created for ${userId}`);
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
   * Track when a user creates a workspace.
   * Increments both newWorkspaces and activeWorkspaces for the week.
   */
  async onWorkspaceCreated(userId: string): Promise<void> {
    this.trackMetric(
      userId,
      { newWorkspaces: 1, activeWorkspaces: 1 },
      "onWorkspaceCreated",
    );
  }

  /**
   * Track general execution activity (updates, actions).
   * Fire-and-forget: does not block the caller.
   *
   * @param userId The user who performed the activity
   */
  async onExecutionActivity(userId: string): Promise<void> {
    this.logger.log(`Metrics update: Execution activity for ${userId}`);
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
      newWorkspaces?: number;
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
      newWorkspaces?: number;
      totalExecutions?: number;
    },
    eventName: string,
  ): Promise<void> {
    try {
      if (!userId) {
        return;
      }

      // Buffer increments instead of immediate DB writes
      this.userMetricsBufferService.addToBuffer(userId, payload);
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
        | "workspaceCreated"
        | "executionActivity";
    }>,
  ): Promise<void> {
    try {
      if (operations.length === 0) {
        return;
      }

      const metricsOperations = operations.map(({ userId, event }) => {
        let payload: {
          apisCreated?: number;
          testflowsExecuted?: number;
          collectionsCount?: number;
          activeWorkspaces?: number;
          newWorkspaces?: number;
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
          case "workspaceCreated":
            payload = { newWorkspaces: 1, activeWorkspaces: 1 };
            break;
          case "executionActivity":
            payload = { totalExecutions: 1 };
            break;
          default:
            payload = {};
        }

        return { userId, payload };
      });

      for (const { userId, payload } of metricsOperations) {
        this.userMetricsBufferService.addToBuffer(userId, payload);
      }
    } catch (error) {
      this.logger.error(
        `Failed to track batch metrics: ${error.message}`,
        error.stack,
      );
    }
  }
}
