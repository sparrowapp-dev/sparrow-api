import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { TestflowSchedulerService } from "./testflow-scheduler.bullmq";

@Injectable()
export class BullMQMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(BullMQMonitoringService.name);
  
  constructor(
    private readonly testflowSchedulerService: TestflowSchedulerService,
  ) {}

  onModuleInit() {
    this.logger.log('BullMQ Monitoring service initialized (API endpoints only)');
  }

  /**
   * Get comprehensive queue statistics
   */
  async getQueueMetrics() {
    try {
      const queue = this.testflowSchedulerService.queue;
      
      const [waiting, active, completed, failed, delayed, repeatableJobs] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
        queue.getRepeatableJobs(),
      ]);

      // Get job counts from the last hour
      const hourAgo = Date.now() - (60 * 60 * 1000);
      const recentCompleted = completed.filter(job => job.timestamp > hourAgo);
      const recentFailed = failed.filter(job => job.timestamp > hourAgo);

      return {
        summary: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          repeatable: repeatableJobs.length,
          total: waiting.length + active.length + completed.length + failed.length + delayed.length,
        },
        lastHour: {
          completed: recentCompleted.length,
          failed: recentFailed.length,
          successRate: recentCompleted.length + recentFailed.length > 0 
            ? (recentCompleted.length / (recentCompleted.length + recentFailed.length)) * 100 
            : 100,
        },
        health: {
          isHealthy: failed.length < 10, // Consider unhealthy if more than 10 failed jobs
          activeJobs: active.length,
          oldestWaitingJob: waiting.length > 0 ? waiting[0].timestamp : null,
        },
        repeatableJobs: repeatableJobs.map(job => ({
          name: job.name,
          pattern: job.pattern,
          next: new Date(job.next),
          tz: job.tz,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get queue metrics:', error);
      throw error;
    }
  }

  /**
   * Get failed jobs with details for troubleshooting
   */
  async getFailedJobsDetails(limit: number = 10) {
    try {
      const failedJobs = await this.testflowSchedulerService.queue.getFailed(0, limit - 1);
      
      return failedJobs.map(job => ({
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        timestamp: new Date(job.timestamp),
        attempts: job.attemptsMade,
        stacktrace: job.stacktrace,
      }));
    } catch (error) {
      this.logger.error('Failed to get failed jobs:', error);
      throw error;
    }
  }

  /**
   * Clean up old jobs for maintenance
   */
  async cleanupOldJobs() {
    try {
      const queue = this.testflowSchedulerService.queue;
      const oneDayAgo = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      // Clean completed jobs older than 1 day
      const completedCleaned = await queue.clean(oneDayAgo, 100, 'completed');
      
      // Clean failed jobs older than 1 day
      const failedCleaned = await queue.clean(oneDayAgo, 100, 'failed');

      this.logger.log(`Cleaned up ${completedCleaned.length} completed jobs and ${failedCleaned.length} failed jobs`);
      
      return {
        completedCleaned: completedCleaned.length,
        failedCleaned: failedCleaned.length,
        totalCleaned: completedCleaned.length + failedCleaned.length,
      };
    } catch (error) {
      this.logger.error('Failed to cleanup old jobs:', error);
      throw error;
    }
  }
}
