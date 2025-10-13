import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Worker, Job } from "bullmq";
import { TESTFLOW_QUEUE } from "./testflow-scheduler.bullmq";
import { TestflowRunService } from "./testflow-run.service";
import { TestflowRepository } from "../repositories/testflow.repository";
import { TestFlowSchedularRunHistory } from "@src/modules/common/models/testflow.model";
import { v4 as uuidv4 } from "uuid";
import { createRedisConnection } from "@src/modules/common/config/redis.config";
import { EmailData, NotificationReceiveType, RunCycleEnum } from "@src/modules/common/enum/testflow.enum";
import { TestflowSchedulerService } from "./testflow-scheduler.bullmq";
import { env } from "process";
import { ConfigService } from "@nestjs/config";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import { EmailService } from "@src/modules/common/services/email.service";

const connection = createRedisConnection();

@Injectable()
export class TestflowWorkerService implements OnModuleInit {
  private readonly logger = new Logger(TestflowWorkerService.name);
  private worker: Worker;

  constructor(
    private readonly testflowRunService: TestflowRunService,
    private readonly testflowRepository: TestflowRepository,
    private readonly testflowSchedulerService: TestflowSchedulerService,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    this.initializeWorker();
  }

  private initializeWorker() {
    this.worker = new Worker(
      TESTFLOW_QUEUE,
      async (job: Job) => {
        await this.processTestflowJob(job);
      },
      {
        connection,
        concurrency: 5, // Process up to 5 jobs concurrently
      }
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`, err.stack);
    });

    this.logger.log('Testflow worker initialized');
  }

  private async processTestflowJob(job: Job) {
    const { schedularId, testflowId, workspaceId, environmentId, user, runCycle } = job.data;
    
    try {
      this.logger.log(`Processing testflow job for schedule: ${schedularId}`);


      // Execute the testflow
      const uuid = uuidv4();
      const runningHistory: TestFlowSchedularRunHistory = {
        id: uuid,
        isScheduled: true,
        status: "pending",
        requests: [],
        responses: [],
        nodes: [],
        edges: [],
        failedRequests: 0,
        successRequests: 0,
        totalTime: "0 ms",
        createdAt: new Date(),
      };
      
      // Save execution result in DB
      await this.testflowRepository.updateSchedularExecution(
        testflowId,
        schedularId,
        runningHistory,
      );

      const response = await this.testflowRunService.handleTestFlowRun(
        environmentId,
        workspaceId,
        testflowId,
      );

      const executedHistory = {
        id: uuid,
        isScheduled: true,
        nodes: response.nodes,
        edges: response.edges,
        ...response.result.history,
        status: response?.result?.history?.status || "error",
      };

      // Save execution result in DB
      await this.testflowRepository.editSchedularExecution(
        testflowId,
        schedularId,
        executedHistory,
      );

    const getSchedular = await this.testflowRepository.getSchedularById(
        testflowId,
        schedularId,
      );

     const data = response?.result?.history;
      let scheduleRunResult;
      if(!response?.status){
        scheduleRunResult = "error";
      }
      else if (data?.status === "fail" && data?.successRequests < 1) {
        scheduleRunResult = "failed";
      } else if (data?.status === "success") {
        scheduleRunResult = "success";
      } else if (data?.status === "error") {
        scheduleRunResult = "error";
      } 
      else {
        scheduleRunResult = "partial";
      }
      const totalRequestCount = data.successRequests + data.failedRequests;
      const userDetails = await this.userRepository.getUserById(
        data.createdBy,
      );
      const successPercentage =
        Math.round((data.successRequests / totalRequestCount) * 100 * 100) /
        100;

      const emailData: EmailData = {
          userName: userDetails?.name,
        scheduleName: getSchedular.name,
        scheduleLastestRun:
          new Date(getSchedular.lastExecuted).toLocaleString("en-US", {
            timeZone: "UTC",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }) + " UTC",
        scheduleRunResult: scheduleRunResult,
        scheduleRunPassedCount: data.successRequests,
        scheduleRunFailedCount: data.failedRequests,
        scheduleRunTotalRequest: data.successRequests + data.failedRequests,
        scheduleRunPassPercentage: successPercentage.toString(),
        scheduleTotalTime: data.totalTime,
        scheduleRunEnvName: response.environmentName,
        isSuccess: data.successRequests === totalRequestCount,
        isFailed: data.successRequests === 0,
        isPartial:
          data.successRequests > 0 && data.successRequests < totalRequestCount,
      };
      if (
        getSchedular.notification.receiveNotifications ===
        NotificationReceiveType.FAILURE
      ) {
        if (data.status === "fail") {
          await this.sendNotification(
            getSchedular.notification.emails,
            emailData,
          );
        }
      }
      if (
        getSchedular.notification.receiveNotifications ===
        NotificationReceiveType.EVERY_TIME
      ) {
        await this.sendNotification(
          getSchedular.notification.emails,
          emailData,
        );
      }

      // Handle post-execution logic based on run cycle type
      if (runCycle.type === RunCycleEnum.ONCE) {
        this.logger.log(`Run cycle is ONCE, removing job and deactivating schedule: ${schedularId}`);
        
        // Remove the job from BullMQ queue
        await this.testflowSchedulerService.removeSchedulerJob(schedularId);
        
        // Deactivate the schedule in database
        await this.testflowRepository.updateSchedularStatus(
          testflowId,
          schedularId,
          false, // isActive = false
        );
      } 
      else if (runCycle.type === RunCycleEnum.HOURLY) {
        this.logger.log(`Run cycle is HOURLY, removing current job and creating next rolling interval job: ${schedularId}`);
        
        // Remove the current job first
        await this.testflowSchedulerService.removeSchedulerJob(schedularId);

        const nextRun = new Date(Date.now() + runCycle.intervalHours * 60 * 1000);
        const second = nextRun.getUTCSeconds();
        const minute = nextRun.getUTCMinutes();
        const hour = nextRun.getUTCHours();
        const dayOfMonth = nextRun.getUTCDate();
        const month = nextRun.getUTCMonth() + 1;
        const nextCronTime = `${second} ${minute} ${hour} ${dayOfMonth} ${month} *`;
        
        await this.testflowSchedulerService.createNextHourlyJob(
          runCycle,
          workspaceId,
          testflowId,
          environmentId,
          schedularId,
          nextCronTime,
          user,
          "UTC"
        );
        await this.testflowRepository.editSchedular(testflowId, schedularId, {
          cronExpression: nextCronTime,
        });
      }

      this.logger.log(`Testflow execution completed for schedule: ${schedularId}`);
    } catch (error) {
      this.logger.error(`Error processing testflow job ${schedularId}:`, error);
      throw error; // Re-throw to mark job as failed
    }
  }

  private async sendNotification(
    emails: string[],
    emailData: EmailData,
  ): Promise<void> {
    if (!emails || emails.length === 0) {
      throw new Error(
        "At least one email address must be provided to send notification.",
      );
    }
    const transporter = this.emailService.createTransporter();
    // Merge emailData
    const context = {
      sparrowEmail: this.configService.get("support.sparrowEmail"),
      sparrowWebsite: this.configService.get("support.sparrowWebsite"),
      sparrowWebsiteName: this.configService.get("support.sparrowWebsiteName"),
      authUrl: this.configService.get("auth.baseURL"),
      ...emailData,
    };
    const promises: Promise<any>[] = [];
    for (const email of emails) {
      if (!email?.trim()) continue;
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: email.trim(),
        text: "Testflow Run Report",
        template: "testflowScheduleRunEmail",
        context,
        subject: `Sparrow Test Report`,
      };
      promises.push(this.emailService.sendEmail(transporter, mailOptions));
    }
    await Promise.all(promises);
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Testflow worker shut down');
    }
  }
}
