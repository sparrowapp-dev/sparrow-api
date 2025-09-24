import { Injectable, Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { v4 as uuidv4 } from "uuid";
import { TestflowRepository } from "../repositories/testflow.repository";
import { CreateTestflowSchedularDto } from "../payloads/testflow.payload";
import { DecodedUserObject } from "@src/types/fastify";
import { TestflowSchedular } from "@src/modules/common/models/testflow.model";
import {
  DailyConfig,
  HourlyConfig,
  OnceConfig,
  RunCycleEnum,
  WeeklyConfig,
} from "@src/modules/common/enum/testflow.enum";
import { RunCycleConfig } from "@src/modules/common/enum/testflow.enum";

@Injectable()
export class TestflowSchedulerService {
  private readonly logger = new Logger(TestflowSchedulerService.name);

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly testflowRepository: TestflowRepository,
  ) {}

  /**
   * Add a cron job
   */
  async addSchedulerJob(
    runCycle: RunCycleConfig,
    runApis: (schedularId: string) => Promise<void>,
    jobName: string,
    cronExpression: string,
    schedularId: string,
  ): Promise<boolean> {
    console.log("Generated cronExpression:", cronExpression);
    if (!cronExpression) {
      console.error(`Invalid run cycle configuration for job ${jobName}`);
      return false;
    }
    const job = new CronJob(cronExpression, async () => {
      if (runApis) {
        await runApis(schedularId);
      }
      // Handle one-time jobs
      if (runCycle.type === RunCycleEnum.ONCE) {
        job.stop();
        this.schedulerRegistry.deleteCronJob(jobName);
        console.log(`One-time scheduler ${jobName} completed and removed`);
      }
    });
    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();
    console.log(
      `Scheduler job ${jobName} registered with cycle: ${runCycle.type}`,
    );
    return true;
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
