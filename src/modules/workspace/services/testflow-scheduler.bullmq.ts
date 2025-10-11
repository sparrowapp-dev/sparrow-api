import { Injectable, Logger } from "@nestjs/common";
import { Queue, Worker, JobsOptions } from "bullmq";
import { RunCycleConfig, RunCycleEnum } from "@src/modules/common/enum/testflow.enum";
import { createRedisConnection } from "@src/modules/common/config/redis.config";
import { DecodedUserObject } from "@src/types/fastify";

const connection = createRedisConnection();

export const TESTFLOW_QUEUE = "testflow-schedule-queue";

@Injectable()
export class TestflowSchedulerService {
  private readonly logger = new Logger(TestflowSchedulerService.name);
  public readonly queue: Queue;

  constructor() {
    this.queue = new Queue(TESTFLOW_QUEUE, { connection });
  }

  /**
   * Add a scheduled job (cron or delayed) to BullMQ
   */
  async addSchedulerJob(
    runCycle: RunCycleConfig,
    cronExpression: string,
    schedularId: string,
    testflowId: string,
    workspaceId: string,
    environmentId: string,
    user: DecodedUserObject,
    timezone: string = "UTC",
  ): Promise<boolean> {
    if (!cronExpression) {
      this.logger.log(`Invalid run cycle configuration for job ${schedularId}`);
      return false;
    }

    try {
      const jobData: any = {
        runCycle,
        schedularId,
        timezone,
        testflowId,
        workspaceId,
        environmentId,
        user,
      };

      let jobOptions: JobsOptions;

    
        // For other recurring jobs (DAILY, WEEKLY), use repeat pattern
        jobOptions = {
            repeat: {
            pattern: cronExpression,
            tz: timezone,
            },
            jobId: schedularId,
        };
      

      await this.queue.add(`execute-testflow-schedule-${schedularId}`, jobData, jobOptions);
      this.logger.log(`Scheduled job ${schedularId} with cron: ${cronExpression}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to create scheduler job ${schedularId}: ${error.message}`,
        error.stack
      );
      return false;
    }
  }

  /**
   * Remove a scheduler job (both repeatable and delayed jobs)
   */
  async removeSchedulerJob(schedulerId: string): Promise<boolean> {
    try {
      let removed = false;
      
      // Remove repeatable jobs - we need to check job data since BullMQ normalizes job names
      const repeatableJobs = await this.queue.getRepeatableJobs();
      this.logger.log(`Found ${repeatableJobs.length} repeatable jobs, looking for schedulerId: ${schedulerId}`);
      
      for (const repeatableJob of repeatableJobs) {
        // Get actual job instances to check their data
        if (repeatableJob.name === `execute-testflow-schedule-${schedulerId}`) {
          await this.queue.removeRepeatableByKey(repeatableJob.key);
          this.logger.log(`Removed repeatable job ${repeatableJob.id} with key: ${repeatableJob.key}`);
          removed = true; 
        }
      }

      if (!removed) {
        this.logger.warn(`Job with schedularId ${schedulerId} not found in queue`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove job ${schedulerId}: ${error.message}`,
        error.stack
      );
      return false;
    }
  }

  /**
   * Pause a scheduler job
   */
  async pauseSchedulerJob(schedulerId: string): Promise<void> {
    // BullMQ doesn't have a direct pause for repeatable jobs
    // We need to remove and re-add when resuming
    await this.removeSchedulerJob(schedulerId);
  }

  /**
   * Resume a scheduler job
   */
  async resumeSchedulerJob(schedulerId: string): Promise<void> {
    // This would need to be implemented by re-adding the job
    // The calling code should handle this by calling addSchedulerJob again
    this.logger.warn(`Resume for job ${schedulerId} needs to be handled by re-adding the job`);
  }

  /**
   * Create a worker to process testflow jobs
   */
  static createWorker(
    processor: (job: any) => Promise<void>
  ): Worker {
    return new Worker(
      TESTFLOW_QUEUE,
      async (job) => {
        await processor(job);
      },
      { connection }
    );
  }

  /**
   * Create next HOURLY job after execution (rolling interval)
   */
  async createNextHourlyJob(
    runCycle: RunCycleConfig,
    workspaceId: string,
    testflowId: string,
    environmentId: string,
    schedularId: string,
    cronExpression: string,
    user: DecodedUserObject,
    timezone: string = "UTC"
  ): Promise<boolean> {
    try {
      

       const jobData: any = {
        runCycle,
        schedularId,
        timezone,
        testflowId,
        workspaceId,
        environmentId,
        user,
      };

      let jobOptions: JobsOptions;

      // For other recurring jobs (DAILY, WEEKLY), use repeat pattern
      jobOptions = {
        repeat: {
        pattern: cronExpression,
        tz: timezone,
        },
        jobId: schedularId,
      };
    

      await this.queue.add(`execute-testflow-schedule-${schedularId}`, jobData, jobOptions);
      this.logger.log(`Created next HOURLY job for ${schedularId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to create next HOURLY job for ${schedularId}:`, error);
      return false;
    }
  }

  /**
   * List all jobs for debugging purposes
   */
  async listAllJobs(): Promise<any> {
    const waitingJobs = await this.queue.getWaiting();
    const delayedJobs = await this.queue.getDelayed();
    const repeatableJobs = await this.queue.getRepeatableJobs();
    
    const result = {
      waiting: waitingJobs.map(job => ({
        id: job.id,
        name: job.name,
        schedularId: job.data?.schedularId,
        runCycle: job.data?.runCycle?.type
      })),
      delayed: delayedJobs.map(job => ({
        id: job.id,
        name: job.name,
        schedularId: job.data?.schedularId,
        runCycle: job.data?.runCycle?.type,
        delay: job.opts?.delay
      })),
      repeatable: repeatableJobs.map(job => ({
        id: job.id,
        name: job.name,
        key: job.key,
        pattern: job.pattern
      }))
    };
    
    this.logger.log(`Current jobs in queue: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Clear all jobs from the testflow queue
   */
  async clearAllJobs(): Promise<void> {
    try {
      // Remove all repeatable jobs
      const repeatableJobs = await this.queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        await this.queue.removeRepeatableByKey(job.key);
        this.logger.log(`Removed repeatable job: ${job.id}`);
      }

      // Clear all job states (waiting, active, completed, failed, delayed)
      await this.queue.drain(); // Remove all waiting jobs
      await this.queue.clean(0, 1000, 'completed'); // Clean completed jobs
      await this.queue.clean(0, 1000, 'failed'); // Clean failed jobs
      await this.queue.clean(0, 1000, 'active'); // Clean active jobs
      await this.queue.clean(0, 1000, 'delayed'); // Clean delayed jobs

      this.logger.log(`Cleared all jobs from testflow queue`);
    } catch (error) {
      this.logger.error(`Failed to clear queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all repeatable jobs
   */
  async getAllScheduledJobs() {
    return await this.queue.getRepeatableJobs();
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();
    const delayed = await this.queue.getDelayed();
    const repeatable = await this.queue.getRepeatableJobs();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      repeatable: repeatable.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length
    };
  }

  /**
   * Get the worker instance for error handling
   */
  getWorker(): Worker | null {
    // This would return the worker instance if we had it
    // For now, return null as the worker is in a separate service
    return null;
  }
}