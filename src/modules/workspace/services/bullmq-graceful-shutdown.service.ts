import { Injectable, Logger, OnApplicationShutdown, BeforeApplicationShutdown } from '@nestjs/common';
import { TestflowSchedulerService } from './testflow-scheduler.bullmq';
import { TestflowWorkerService } from './testflow-worker.service';

@Injectable()
export class BullMQGracefulShutdownService implements BeforeApplicationShutdown, OnApplicationShutdown {
  private readonly logger = new Logger(BullMQGracefulShutdownService.name);
  private isShuttingDown = false;

  constructor(
    private readonly schedulerService: TestflowSchedulerService,
    private readonly workerService: TestflowWorkerService,
  ) {}

  async beforeApplicationShutdown(signal?: string) {
    this.logger.log(`Received shutdown signal: ${signal}. Starting graceful shutdown...`);
    this.isShuttingDown = true;

    try {
      // 1. Stop accepting new jobs
      await this.pauseQueue();
      
      // 2. Wait for active jobs to complete (with timeout)
      await this.waitForActiveJobs();
      
      // 3. Close worker connections
      await this.closeWorker();
      
    } catch (error) {
      this.logger.error('Error during graceful shutdown preparation:', error);
    }
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Application shutdown signal: ${signal}. Closing queue connections...`);
    
    try {
      // Close queue connection
      await this.closeQueue();
      
      this.logger.log('Graceful shutdown completed successfully');
    } catch (error) {
      this.logger.error('Error during final shutdown:', error);
    }
  }

  private async pauseQueue(): Promise<void> {
    try {
      await this.schedulerService.queue.pause();
      this.logger.log('Queue paused - no new jobs will be processed');
    } catch (error) {
      this.logger.error('Failed to pause queue:', error);
      throw error;
    }
  }

  private async waitForActiveJobs(maxWaitTime = 30000): Promise<void> {
    const startTime = Date.now();
    this.logger.log('Waiting for active jobs to complete...');

    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        try {
          const activeJobs = await this.schedulerService.queue.getActive();
          const elapsedTime = Date.now() - startTime;

          if (activeJobs.length === 0) {
            this.logger.log('All active jobs completed');
            clearInterval(checkInterval);
            resolve();
          } else if (elapsedTime >= maxWaitTime) {
            this.logger.warn(`Timeout reached. ${activeJobs.length} jobs still active. Proceeding with shutdown.`);
            clearInterval(checkInterval);
            resolve();
          } else {
            this.logger.log(`${activeJobs.length} jobs still active. Waiting... (${elapsedTime}ms/${maxWaitTime}ms)`);
          }
        } catch (error) {
          this.logger.error('Error checking active jobs:', error);
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000); // Check every second
    });
  }

  private async closeWorker(): Promise<void> {
    try {
      await this.workerService.closeWorker();
    } catch (error) {
      this.logger.error('Failed to close worker:', error);
      throw error;
    }
  }

  private async closeQueue(): Promise<void> {
    try {
      await this.schedulerService.queue.close();
      this.logger.log('Queue connection closed successfully');
    } catch (error) {
      this.logger.error('Failed to close queue:', error);
      throw error;
    }
  }

  /**
   * Force shutdown if graceful shutdown takes too long
   */
  async forceShutdown(): Promise<void> {
    this.logger.warn('Force shutdown initiated');
    
    try {
      // Force close everything
      await Promise.allSettled([
        this.workerService.closeWorker(true), // Force close worker
        this.schedulerService.queue.close(), // Close queue
      ]);
      
      this.logger.log('Force shutdown completed');
    } catch (error) {
      this.logger.error('Error during force shutdown:', error);
    }
  }

  /**
   * Check if the service is in shutdown mode
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get shutdown status for health checks
   */
  getShutdownStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      timestamp: new Date(),
    };
  }
}
