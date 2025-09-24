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
   * Add a cron job with persistence in MongoDB
   */
  async addSchedulerJob(
    runCycle: RunCycleConfig,
    callback?: () => void,
    schedularData?: CreateTestflowSchedularDto,
    user?: DecodedUserObject,
  ): Promise<void> {
    const { testflowId, name, environmentId, runConfiguration, notification } =
      schedularData;
    const schedulerId = uuidv4();
    const jobName = this.generateJobName(schedulerId);
    console.log("Generated jobName:", jobName);
    const cronExpression = this.generateCronExpression(runCycle);
    console.log("Generated cronExpression:", cronExpression);
    if (!cronExpression) {
      console.error(
        `Invalid run cycle configuration for scheduler ${schedulerId}`,
      );
      return;
    }
    const job = new CronJob(cronExpression, async () => {
      if (callback) {
        callback();
      }
      console.log("Updating scheduler execution in DB with:", {
        testflowId,
        schedulerId,
        userId: user?._id,
      });
      await this.testflowRepository.updateSchedularExecution(
        testflowId,
        schedulerId,
        user._id,
        {
          failedRequests: "2",
          requests: [
            {
              method: "POST",
              name: "CreateUser",
              status: "Failed",
              time: "2025-09-23T18:30:00Z",
            },
            {
              method: "GET",
              name: "FetchUser",
              status: "Success",
              time: "2025-09-23T18:31:00Z",
            },
          ],
          status: "completed",
          successRequests: 5,
          totalTime: "00:05:30",
          createdAt: new Date("2025-09-23T18:00:00Z"),
          updatedAt: new Date("2025-09-23T18:40:00Z"),
          createdBy: "aakash",
          updatedBy: "aakash",
        },
      );
      // Only deactivate if this is a "once" job
      if (runCycle.type === RunCycleEnum.ONCE) {
        // update DB flag
        await this.testflowRepository.updateSchedularStatus(
          testflowId,
          schedulerId,
          user._id,
          false,
        );
        // stop and remove job from registry
        job.stop();
        this.schedulerRegistry.deleteCronJob(jobName);
        console.log(
          `One-time scheduler ${jobName} (ID: ${schedulerId}) completed and deactivated`,
        );
      }
    });
    const newSchedular: TestflowSchedular = {
      id: schedulerId,
      name,
      environmentId,
      runConfiguration,
      notification,
      isActive: true,
      cronExpression,
      schedularName: jobName,
      executedCount: 0,
      lastExecuted: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user._id.toString(),
      updatedBy: user._id.toString(),
    };
    // Insert into repo (MongoDB)
    await this.testflowRepository.addSchedular(testflowId, newSchedular);
    // Register and start the job
    this.schedulerRegistry.addCronJob(jobName, job);
    console.log("CronJob registered in schedulerRegistry:", jobName);
    job.start();
    console.log(
      `Scheduler job ${jobName} (ID: ${schedulerId}) added with cycle: ${runCycle.type}`,
    );
  }

  /**
   * Remove a scheduler job (from registry + MongoDB)
   */
  async removeSchedulerJob(
    schedulerId: string,
    testflowId: string,
    user: DecodedUserObject,
  ): Promise<boolean> {
    const jobName = this.generateJobName(schedulerId);
    try {
      if (this.schedulerRegistry.doesExist("cron", jobName)) {
        const job = this.schedulerRegistry.getCronJob(jobName);
        job.stop();
        this.schedulerRegistry.deleteCronJob(jobName);
      }
      await this.testflowRepository.removeSchedular(
        testflowId,
        schedulerId,
        user._id,
      );
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
  async pauseSchedulerJob(
    schedulerId: string,
    testflowId: string,
    user: DecodedUserObject,
  ): Promise<void> {
    const jobName = this.generateJobName(schedulerId);
    if (this.schedulerRegistry.doesExist("cron", jobName)) {
      const job = this.schedulerRegistry.getCronJob(jobName);
      job.stop();
      await this.testflowRepository.updateSchedularStatus(
        testflowId,
        schedulerId,
        user._id,
        false,
      );
      this.logger.log(`Scheduler job ${jobName} paused`);
    }
  }

  /**
   * Resume a scheduler job
   */
  async resumeSchedulerJob(
    schedulerId: string,
    testflowId: string,
    user: DecodedUserObject,
  ): Promise<void> {
    const jobName = this.generateJobName(schedulerId);
    if (this.schedulerRegistry.doesExist("cron", jobName)) {
      const job = this.schedulerRegistry.getCronJob(jobName);
      job.start();
      await this.testflowRepository.updateSchedularStatus(
        testflowId,
        schedulerId,
        user._id,
        true,
      );
      this.logger.log(`Scheduler job ${jobName} resumed`);
    }
  }

  /**
   * Generate cron expression based on run cycle configuration
   */
  private generateCronExpression(runCycle: RunCycleConfig): string | null {
    switch (runCycle.type) {
      case RunCycleEnum.ONCE:
        return this.generateOnceCronExpression(runCycle);
      case RunCycleEnum.DAILY:
        return this.generateDailyCronExpression(runCycle);
      case RunCycleEnum.HOURLY:
        return this.generateHourlyCronExpression(runCycle);
      case RunCycleEnum.WEEKLY:
        return this.generateWeeklyCronExpression(runCycle);
      default:
        return null;
    }
  }

  private generateOnceCronExpression(config: OnceConfig): string | null {
    const executeAt = config.executeAt;
    const now = new Date();
    if (executeAt <= now) {
      this.logger.warn(
        `Execution time ${executeAt.toISOString()} is in the past`,
      );
      return null;
    }
    const second = executeAt.getSeconds();
    const minute = executeAt.getMinutes();
    const hour = executeAt.getHours();
    const dayOfMonth = executeAt.getDate();
    const month = executeAt.getMonth() + 1;
    return `${second} ${minute} ${hour} ${dayOfMonth} ${month} *`;
  }

  private generateDailyCronExpression(config: DailyConfig): string {
    const { hour, minute, second = 0 } = config.time;
    return `${second} ${minute} ${hour} * * *`;
  }

  private generateHourlyCronExpression(config: HourlyConfig): string {
    const { intervalHours, startTime } = config;
    if (startTime) {
      const { hour, minute, second = 0 } = startTime;
      return `${second} ${minute} ${hour}-23/${intervalHours} * * *`;
    } else {
      return `0 0 */${intervalHours} * * *`;
    }
  }

  private generateWeeklyCronExpression(config: WeeklyConfig): string {
    const { days, time } = config;
    const { hour, minute, second = 0 } = time;
    return `${second} ${minute} ${hour} * * ${days.join(",")}`;
  }

  private generateJobName(schedulerId: string): string {
    return `scheduler_${schedulerId}`;
  }
}
