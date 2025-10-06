import { Injectable, Logger,} from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { RunCycleEnum } from "@src/modules/common/enum/testflow.enum";
import { RunCycleConfig } from "@src/modules/common/enum/testflow.enum";

@Injectable()
export class TestflowSchedulerService {
  private readonly logger = new Logger(TestflowSchedulerService.name);

  constructor(private schedulerRegistry: SchedulerRegistry) {}

  /**
   * Add a cron job
   */
  async addSchedulerJob(
    runCycle: RunCycleConfig,
    runApis: (schedularId: string) => Promise<void>,
    jobName: string,
    cronExpression: string,
    schedularId: string,
    timezone: string = "UTC", // Always use UTC by default
  ): Promise<boolean> {
    if (!cronExpression) {
      console.error(`Invalid run cycle configuration for job ${jobName}`);
      this.logger.log(`Invalid run cycle configuration for job ${jobName}`);
      return false;
    }
    try {
      // Create cron job with UTC timezone
      const job = new CronJob(
        cronExpression,
        async () => {
          this.logger.log(
            `Executing job ${jobName} at ${new Date().toISOString()} (UTC)`
          );
          if (runApis) {
            try {
              await runApis(schedularId);
            } catch (error) {
              this.logger.error(
                `Error executing job ${jobName}: ${error.message}`,
                error.stack
              );
            }
          }
          // Handle one-time jobs
          if (runCycle.type === RunCycleEnum.ONCE) {
            job.stop();
            this.schedulerRegistry.deleteCronJob(jobName);
            this.logger.log(`One-time scheduler ${jobName} completed and removed`);
          }
        },
        null, // onComplete callback
        false, // start - we'll call start() manually
        timezone, // Set timezone to UTC
      );
      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();
      this.logger.log(
        `Scheduler job ${jobName} registered with cycle: ${runCycle.type}, ` +
        `timezone: ${timezone}, cron: ${cronExpression}`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to create scheduler job ${jobName}: ${error.message}`,
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
      this.logger.log(
        `Scheduler job ${jobName} (ID: ${schedulerId}) removed from DB + registry`,
      );
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
      this.logger.log(`Scheduler job ${jobName} paused`);
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
      this.logger.log(`Scheduler job ${jobName} resumed`);
    }
  }

  private generateJobName(schedulerId: string): string {
    return `scheduler_${schedulerId}`;
  }
}
