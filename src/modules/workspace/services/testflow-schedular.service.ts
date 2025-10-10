import { Injectable, Logger,} from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { RunCycleEnum } from "@src/modules/common/enum/testflow.enum";
import { RunCycleConfig } from "@src/modules/common/enum/testflow.enum";
import { TestflowRepository } from "../repositories/testflow.repository";

@Injectable()
export class TestflowSchedulerService {
  private readonly logger = new Logger(TestflowSchedulerService.name);

  constructor(private schedulerRegistry: SchedulerRegistry ) {}

  /**
   * Add a cron job
   */
  async addSchedulerJob(
    runCycle: RunCycleConfig,
    runApis: (schedularId: string) => Promise<void>,
    afterJobCreate: (cronExpression: string) => void,
    cronExpression: string,
    schedularId: string,
    timezone: string = "UTC", // Always use UTC by default
  ): Promise<boolean> {
    if (!cronExpression) {
      this.logger.log(`Invalid run cycle configuration for job ${schedularId}`);
      return false;
    }
    try {
      // For HOURLY rolling interval, create a one-time cron job for the next execution
      if (runCycle.type === RunCycleEnum.HOURLY && runCycle.intervalHours) {

        const scheduleNext = async (lastRun: Date) => {
          // Calculate next run time
          const nextRun = new Date(lastRun.getTime() + runCycle.intervalHours * 60 * 60 * 1000);
          // Generate one-time cron expression for nextRun
          const second = nextRun.getUTCSeconds();
          const minute = nextRun.getUTCMinutes();
          const hour = nextRun.getUTCHours();
          const dayOfMonth = nextRun.getUTCDate();
          const month = nextRun.getUTCMonth() + 1;
          const oneTimeCron = `${second} ${minute} ${hour} ${dayOfMonth} ${month} *`;
          const nextJobName = schedularId; // Always use scheduleId as job name
          this.logger.log(`Next rolling interval job ${nextJobName} scheduled for ${nextRun.toISOString()} (cron: ${oneTimeCron})`);
          // Remove any existing job with this name before adding
          if (this.schedulerRegistry.doesExist("cron", nextJobName)) {
            const oldJob = this.schedulerRegistry.getCronJob(nextJobName);
            oldJob.stop();
            this.schedulerRegistry.deleteCronJob(nextJobName);
          }
          const job = new CronJob(
            oneTimeCron,
            async () => {
              this.logger.log(`Executing rolling interval job ${nextJobName} at ${new Date().toISOString()} (UTC)`);
              if (runApis) {
                try {
                  await runApis(schedularId);
                } catch (error) {
                  this.logger.error(`Error executing job ${nextJobName}: ${error.message}`, error.stack);
                }
              }
              job.stop();
              this.schedulerRegistry.deleteCronJob(nextJobName);
              // Schedule next job
              await scheduleNext(nextRun);
            },
            null,
            false,
            timezone,
          );
          afterJobCreate(oneTimeCron);
          this.schedulerRegistry.addCronJob(nextJobName, job);
          job.start();
        };
        // Use the provided initial cron expression for the first run
        const nextJobName = schedularId;
        // Remove any existing job with this name before adding
        if (this.schedulerRegistry.doesExist("cron", nextJobName)) {
          const oldJob = this.schedulerRegistry.getCronJob(nextJobName);
          oldJob.stop();
          this.schedulerRegistry.deleteCronJob(nextJobName);
        }
        const job = new CronJob(
          cronExpression,
          async () => {
            if (runApis) {
              try {
                await runApis(schedularId);
              } catch (error) {
                this.logger.error(`Error executing job ${nextJobName}: ${error.message}`, error.stack);
              }
            }
            job.stop();
            this.schedulerRegistry.deleteCronJob(nextJobName);
            // After first run, start rolling with scheduleNext
            await scheduleNext(new Date());
          },
          null,
          false,
          timezone,
        );
        this.schedulerRegistry.addCronJob(nextJobName, job);
        job.start();
        return true;
      }
      // Default: Create cron job with UTC timezone
      const job = new CronJob(
        cronExpression,
        async () => {
          if (runApis) {
            try {
              await runApis(schedularId);
            } catch (error) {
              this.logger.error(
                `Error executing job ${schedularId}: ${error.message}`,
                error.stack
              );
            }
          }
          // Handle one-time jobs
          if (runCycle.type === RunCycleEnum.ONCE) {
            job.stop();
            this.schedulerRegistry.deleteCronJob(schedularId);
          }
        },
        null, // onComplete callback
        false, // start - we'll call start() manually
        timezone, // Set timezone to UTC
      );
      this.schedulerRegistry.addCronJob(schedularId, job);
      job.start();
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
   * Remove a scheduler job
   */
  async removeSchedulerJob(schedulerId: string): Promise<boolean> {
    const jobName = this.generateJobName(schedulerId);
    try {
      if (this.schedulerRegistry.doesExist("cron", jobName)) {
        const job = this.schedulerRegistry.getCronJob(jobName);
        job.stop();
        this.schedulerRegistry.deleteCronJob(jobName);
      }
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to remove job ${jobName} (ID: ${schedulerId}): ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Pause a scheduler job
   */
  async pauseSchedulerJob(schedulerId: string): Promise<void> {
    const jobName = this.generateJobName(schedulerId);
    if (this.schedulerRegistry.doesExist("cron", jobName)) {
      const job = this.schedulerRegistry.getCronJob(jobName);
      job.stop();
    }
  }

  /**
   * Resume a scheduler job
   */
  async resumeSchedulerJob(schedulerId: string): Promise<void> {
    const jobName = this.generateJobName(schedulerId);
    if (this.schedulerRegistry.doesExist("cron", jobName)) {
      const job = this.schedulerRegistry.getCronJob(jobName);
      job.start();
    }
  }

  private generateJobName(schedulerId: string): string {
    return `${schedulerId}`;
  }

  public logAllCronJobs() {
    return Array.from(this.schedulerRegistry.getCronJobs().keys());
  }
}
