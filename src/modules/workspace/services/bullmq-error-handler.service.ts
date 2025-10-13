import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { TestflowSchedulerService } from "./testflow-scheduler.bullmq";

@Injectable()
export class BullMQErrorHandler implements OnModuleDestroy {
  private readonly logger = new Logger(BullMQErrorHandler.name);
  private errorCount = 0;
  private lastErrorTime = 0;
  private readonly maxErrorRate = 10; // max 10 errors per minute
  private readonly errorWindow = 60000; // 1 minute

  constructor(private readonly schedulerService: TestflowSchedulerService) {
    this.setupErrorHandlers();
  }

  onModuleDestroy() {
    this.logger.log('BullMQ Error Handler shutting down');
  }

  private setupErrorHandlers() {
    const queue = this.schedulerService.queue;

    // Queue-level error handling
    queue.on('error', (error) => {
      this.handleQueueError('Queue Error', error);
    });

    queue.on('waiting', (job) => {
      this.logger.debug(`Job ${job.id} is waiting`);
    });

    queue.on('active', (job) => {
      this.logger.debug(`Job ${job.id} started processing`);
    });

    queue.on('completed', (job, result) => {
      this.logger.log(`Job ${job.id} completed successfully`);
      this.resetErrorCounter();
    });

    queue.on('failed', (job, error) => {
      this.handleJobFailure(job, error);
    });

    queue.on('stalled', (job) => {
      this.logger.warn(`Job ${job.id} stalled and will be retried`);
      this.incrementErrorCount();
    });

    // Worker error handling
    const worker = this.schedulerService.getWorker();
    if (worker) {
      worker.on('error', (error) => {
        this.handleWorkerError(error);
      });

      worker.on('failed', (job, error) => {
        this.handleJobFailure(job, error);
      });
    }
  }

  private handleQueueError(type: string, error: any) {
    this.logger.error(`${type}:`, error);
    this.incrementErrorCount();

    // Check if we need to take action due to high error rate
    if (this.isErrorRateHigh()) {
      this.handleHighErrorRate();
    }
  }

  private handleJobFailure(job: any, error: any) {
    this.logger.error(`Job ${job?.id} failed:`, {
      jobId: job?.id,
      jobData: job?.data,
      error: error.message,
      stack: error.stack,
      attempts: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts,
    });

    this.incrementErrorCount();

    // Send alerts for critical job failures
    if (this.isCriticalJobFailure(job, error)) {
      this.sendJobFailureAlert(job, error);
    }
  }

  private handleWorkerError(error: any) {
    this.logger.error('Worker Error:', error);
    this.incrementErrorCount();
  }

  private incrementErrorCount() {
    const now = Date.now();
    
    // Reset counter if error window has passed
    if (now - this.lastErrorTime > this.errorWindow) {
      this.errorCount = 0;
    }
    
    this.errorCount++;
    this.lastErrorTime = now;
  }

  private resetErrorCounter() {
    if (this.errorCount > 0) {
      this.errorCount = Math.max(0, this.errorCount - 1);
    }
  }

  private isErrorRateHigh(): boolean {
    const now = Date.now();
    return this.errorCount >= this.maxErrorRate && 
           (now - this.lastErrorTime) < this.errorWindow;
  }

  private handleHighErrorRate() {
    this.logger.warn(`High error rate detected: ${this.errorCount} errors in the last minute`);
    
    // Could implement circuit breaker, alerting, or other protective measures
    // For now, just log and potentially pause the queue temporarily
    this.pauseQueueTemporarily();
  }

  private async pauseQueueTemporarily() {
    try {
      const queue = this.schedulerService.queue;
      await queue.pause();
      
      this.logger.warn('Queue paused due to high error rate');
      
      // Resume after 30 seconds
      setTimeout(async () => {
        try {
          await queue.resume();
          this.logger.log('Queue resumed after error rate cooldown');
          this.errorCount = 0; // Reset error count
        } catch (error) {
          this.logger.error('Failed to resume queue:', error);
        }
      }, 30000);
      
    } catch (error) {
      this.logger.error('Failed to pause queue:', error);
    }
  }

  private isCriticalJobFailure(job: any, error: any): boolean {
    // Define conditions for critical failures
    return job?.attemptsMade >= (job?.opts?.attempts || 3) || 
           error.message.includes('CRITICAL') ||
           error.message.includes('FATAL');
  }

  private sendJobFailureAlert(job: any, error: any) {
    // In production, this could send to Slack, email, or monitoring system
    this.logger.error('CRITICAL JOB FAILURE ALERT', {
      jobId: job?.id,
      jobType: job?.name,
      jobData: job?.data,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats() {
    return {
      currentErrorCount: this.errorCount,
      lastErrorTime: this.lastErrorTime,
      isErrorRateHigh: this.isErrorRateHigh(),
      errorWindow: this.errorWindow,
      maxErrorRate: this.maxErrorRate,
    };
  }
}
