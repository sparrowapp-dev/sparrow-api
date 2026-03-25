import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { UserMetricsRepository } from "../repositories/userMetrics.repository";
import { IncrementMetricsPayload } from "@src/modules/common/models/user-metrics.model";

@Injectable()
export class UserMetricsBufferService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserMetricsBufferService.name);

  // buffer: userId -> payload
  private buffer: Map<string, IncrementMetricsPayload> = new Map();

  private intervalId: NodeJS.Timeout | null = null;

  // flush threshold
  private readonly FLUSH_THRESHOLD = 500;

  // flush interval (ms)
  private readonly FLUSH_INTERVAL = 1000;

  private isFlushing = false;

  constructor(private readonly userMetricsRepository: UserMetricsRepository) {}

  onModuleInit() {
    // start periodic flush
    this.intervalId = setInterval(
      () =>
        this.flush().catch((e) =>
          this.logger.error("Periodic flush failed", e),
        ),
      this.FLUSH_INTERVAL,
    );
  }

  onModuleDestroy() {
    // clear interval and flush remaining
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // flush synchronously (best-effort)
    this.flush().catch((e) => this.logger.error("Flush on destroy failed", e));
  }

  /**
   * Merge and buffer payload for a user.
   */
  addToBuffer(userId: string, payload: IncrementMetricsPayload): void {
    if (!userId || !payload) return;

    const existing = this.buffer.get(userId);
    if (!existing) {
      // clone to avoid external mutation
      this.buffer.set(userId, { ...payload });
    } else {
      // sum numeric fields
      if (payload.totalExecutions !== undefined) {
        existing.totalExecutions =
          (existing.totalExecutions || 0) + payload.totalExecutions;
      }
      if (payload.apisCreated !== undefined) {
        existing.apisCreated =
          (existing.apisCreated || 0) + payload.apisCreated;
      }
      if (payload.collectionsCount !== undefined) {
        existing.collectionsCount =
          (existing.collectionsCount || 0) + payload.collectionsCount;
      }
      if (payload.activeWorkspaces !== undefined) {
        existing.activeWorkspaces =
          (existing.activeWorkspaces || 0) + payload.activeWorkspaces;
      }
      if (payload.testflowsExecuted !== undefined) {
        existing.testflowsExecuted =
          (existing.testflowsExecuted || 0) + payload.testflowsExecuted;
      }
      if (payload.newWorkspaces !== undefined) {
        existing.newWorkspaces =
          (existing.newWorkspaces || 0) + payload.newWorkspaces;
      }
      // write back (map stores reference)
      this.buffer.set(userId, existing);
    }

    if (this.buffer.size >= this.FLUSH_THRESHOLD) {
      // trigger async flush but don't await
      this.flush().catch((e) =>
        this.logger.error("Flush on threshold failed", e),
      );
    }

    if (this.buffer.size % 50 === 0) {
      this.logger.debug(`Buffered metrics for ${this.buffer.size} users`);
    }
  }

  /**
   * Flush buffered metrics to the repository in bulk.
   */
  async flush(): Promise<void> {
    if (this.isFlushing) return;

    this.isFlushing = true;

    let current: Map<string, IncrementMetricsPayload>;

    try {
      if (this.buffer.size === 0) return;

      current = this.buffer;
      this.buffer = new Map();

      const weekStart = this.userMetricsRepository.getWeekStart();

      const operations = Array.from(current.entries()).map(
        ([userId, payload]) => ({ userId, payload }),
      );

      this.logger.log(`Flushing ${operations.length} metric operations`);

      await this.userMetricsRepository.bulkIncrementMetrics(
        operations,
        weekStart,
      );

      // Also flush per-user daily execution counts to user_metrics_daily
      try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const dailyIncs = operations
          .map(({ userId, payload }) => ({ userId, payload }))
          .filter(({ payload }) => (payload.totalExecutions || 0) > 0)
          .map(({ userId, payload }) => ({
            userId,
            totalExecutions: payload.totalExecutions || 0,
          }));

        if (dailyIncs.length > 0) {
          // Delegate to repository to perform the bulk daily increments
          await this.userMetricsRepository.bulkIncrementDailyMetrics(dailyIncs);

          this.logger.log(
            `Flushed daily metrics for ${dailyIncs.length} users`,
          );
        }
      } catch (dailyErr) {
        this.logger.error("Failed to flush daily user metrics", dailyErr);
      }
      this.logger.log(`Flushed ${operations.length} operations`);
    } catch (error) {
      this.logger.error("Failed to flush user metrics buffer", error);

      // 🔥 RESTORE BUFFER (IMPORTANT)
      for (const [userId, payload] of current.entries()) {
        this.addToBuffer(userId, payload);
      }
    } finally {
      this.isFlushing = false;
    }
  }
}
