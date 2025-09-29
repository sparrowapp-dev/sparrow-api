// ---- Libraries
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

// ---- Mongo
import { DeleteResult, ObjectId, WithId } from "mongodb";

// ---- Services
import { ProducerService } from "@src/modules/common/services/event-producer.service";
import { WorkspaceService } from "./workspace.service";

// ---- Enum
import { ErrorMessages } from "@src/modules/common/enum/error-messages.enum";
import { WorkspaceRole } from "@src/modules/common/enum/roles.enum";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { UpdatesType } from "@src/modules/common/enum/updates.enum";

// ---- Repository
import { WorkspaceRepository } from "../repositories/workspace.repository";
import { TestflowRepository } from "../repositories/testflow.repository";

// ---- Model & Payload
import {
  Workspace,
  WorkspaceType,
} from "@src/modules/common/models/workspace.model";
import {
  CreateTestflowDto,
  CreateTestflowSchedularDto,
  UpdateTestflowDto,
} from "../payloads/testflow.payload";
import {
  RunConfigurationDto,
  Testflow,
  TestflowSchedular,
} from "@src/modules/common/models/testflow.model";
import { DecodedUserObject } from "@src/types/fastify";
import { v4 as uuidv4 } from "uuid";
import { TestflowSchedulerService } from "./testflow-schedular.service";
import {
  DailyConfig,
  EmailData,
  HourlyConfig,
  NotificationReceiveType,
  OnceConfig,
  RunCycleConfig,
  RunCycleEnum,
  WeeklyConfig,
} from "@src/modules/common/enum/testflow.enum";
import { TestflowRunService } from "./testflow-run.service";
import { EmailService } from "@src/modules/common/services/email.service";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { OnModuleInit } from "@nestjs/common";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";

/**
 * Testflow Service
 */
@Injectable()
export class TestflowService implements OnModuleInit  {
  private readonly logger = new Logger(TestflowService.name);
  constructor(
    private readonly testflowRepository: TestflowRepository,
    private readonly workspaceReposistory: WorkspaceRepository,
    private readonly producerService: ProducerService,
    private readonly workspaceService: WorkspaceService,
    private readonly testflowSchedulerService: TestflowSchedulerService,
    private readonly testflowRunService: TestflowRunService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly userReposistory:UserRepository
  ) {}

   async onModuleInit() {
    this.logger.log("Bootstrapping schedulers from DB...");
    const testflows = await this.testflowRepository.getAll();
    for (const tf of testflows) {
      if (!tf.schedules?.length) continue;
      for (const schedule of tf.schedules) {
        const runCycleConfig = this.buildRunCycleConfig(
          schedule.runConfiguration,
        );
        if (schedule.isActive && schedule.cronExpression) {
          await this.testflowSchedulerService.addSchedulerJob(
            runCycleConfig,
            this.getScheduledExecutionCallback(
              tf._id.toString(),
              schedule.environmentId,
              tf.workspaceId,
              schedule.id
            ),
            schedule.schedularName,
            schedule.cronExpression,
            schedule.id,
          );
        }
      }
    }
   }

  /**
   * Creates new testflow.
   * @param createTestflowDto - Testflow object to be inserted.
   */
  async createTestflow(
    createTestflowDto: CreateTestflowDto,
    user: DecodedUserObject,
  ): Promise<WithId<Testflow>> {
    const workspace = await this.isWorkspaceAdminorEditor(
      createTestflowDto.workspaceId,
      user._id,
    );
    const updateMessage = `New testflow "${createTestflowDto.name}" is added under "${workspace.name}" workspace`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        type: UpdatesType.TESTFLOW,
        workspaceId: createTestflowDto.workspaceId,
        user,
      }),
    });

    const newTestflow: Testflow = {
      name: createTestflowDto.name,
      workspaceId: createTestflowDto.workspaceId,
      nodes: createTestflowDto.nodes,
      edges: createTestflowDto.edges,
      createdBy: user._id.toString(),
      updatedBy: user._id.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const testflowData = await this.testflowRepository.addTestflow(newTestflow);
    await this.workspaceService.addTestflowInWorkSpace(
      createTestflowDto.workspaceId,
      { name: createTestflowDto.name, id: testflowData.insertedId.toString() },
      user._id,
    );
    const testflow = await this.testflowRepository.get(
      testflowData.insertedId.toString(),
    );
    const currentWorkspaceObject = new ObjectId(createTestflowDto.workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    return testflow;
  }

  /**
   * Fetches single testflow.
   * @param id - Testflow id you want to fetch.
   */
  async getTestflow(id: string): Promise<WithId<Testflow>> {
    return await this.testflowRepository.get(id);
  }

  /**
   * Checks permissions to user with their workspace.
   * @param workspaceId - Workspace id.
   * @param userid - User id to match with workspace.
   */
  async checkPermission(workspaceId: string, userid: ObjectId): Promise<void> {
    const workspace = await this.workspaceService.get(workspaceId);
    const hasPermission = workspace.users.some((user) => {
      return user.id.toString() === userid.toString();
    });
    if (!hasPermission) {
      throw new UnauthorizedException(ErrorMessages.Unauthorized);
    }
  }

  /**
   * Deletes an existing testflow.
   * @param id - Testflow id you want to delete.
   * @param workspaceId - Workspace id you want to delete from it.
   */
  async deleteTestflow(
    id: string,
    workspaceId: string,
    user: DecodedUserObject,
  ): Promise<DeleteResult> {
    const workspace = await this.isWorkspaceAdminorEditor(
      workspaceId,
      user._id,
    );
    const testflow = await this.testflowRepository.get(id);
    const data = await this.testflowRepository.delete(id);
    await this.workspaceService.deleteTestflowInWorkSpace(
      workspaceId,
      id,
      user._id,
    );
    const updateMessage = `"${testflow.name}" testflow is deleted from "${workspace.name}" workspace`;
    const currentWorkspaceObject = new ObjectId(workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        type: UpdatesType.TESTFLOW,
        workspaceId: workspaceId,
        user,
      }),
    });
    return data;
  }

  /**
   * Fetches all the testflows corresponding to a workspace.
   * @param id - Workspace id you want to get their testflows.
   */
  async getAllTestflows(
    id: string,
    userId: ObjectId,
  ): Promise<WithId<Testflow>[]> {
    await this.checkPermission(id, userId);
    const workspace = await this.workspaceService.get(id);
    const testflowIds = workspace.testflows?.map((t) => t.id.toString()) || [];
    if (testflowIds.length === 0) return [];
    const testflows =
      await this.testflowRepository.getTestflowsByIds(testflowIds);
    return testflows;
  }

  /**
   * Fetches all the testflows corresponding to a public workspace.
   * @param id - Workspace id you want to get their testflows.
   */
  async getAllPublicTestflows(id: string): Promise<WithId<Testflow>[]> {
    const workspace = await this.workspaceService.get(id);
    if (workspace.workspaceType !== WorkspaceType.PUBLIC) {
      throw new BadRequestException("Workspace is not public.");
    }
    const testflowIds = workspace.testflows?.map((t) => t.id.toString()) || [];
    if (testflowIds.length === 0) return [];
    const testflows =
      await this.testflowRepository.getTestflowsByIds(testflowIds);
    return testflows;
  }

  /**
   * Updates an existing testflow.
   * @param testflowId - Testflow id you want to update.
   * @param updateTestflowDto - Updated testflow object.
   * @param workspaceId - Workspace id you want to update into it.
   */
  async updateTestflow(
    testflowId: string,
    updateTestflowDto: Partial<UpdateTestflowDto>,
    workspaceId: string,
    user: DecodedUserObject,
  ): Promise<WithId<Testflow>> {
    const workspace = await this.isWorkspaceAdminorEditor(
      workspaceId,
      user._id,
    );
    await this.testflowRepository.update(
      testflowId,
      updateTestflowDto,
      user._id,
    );
    const testflow = await this.testflowRepository.get(testflowId);
    if (updateTestflowDto?.name) {
      await this.workspaceService.updateTestflowInWorkSpace(
        workspaceId,
        testflowId,
        updateTestflowDto.name,
        user._id,
      );
      const updateMessage = `"${testflow.name}" testflow is renamed to "${updateTestflowDto.name}" testflow under "${workspace.name}" workspace`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.TESTFLOW,
          workspaceId: workspaceId,
          user,
        }),
      });
    }
    const currentWorkspaceObject = new ObjectId(workspaceId);
    const updateWorkspaceData: Partial<Workspace> = {
      updatedAt: new Date(),
    };
    await this.workspaceReposistory.updateWorkspaceById(
      currentWorkspaceObject,
      updateWorkspaceData,
    );
    return testflow;
  }

  /**
   * Checks if user is admin or editor of workspace.
   * @param id - Workspace id.
   */
  async isWorkspaceAdminorEditor(
    id: string,
    userId: ObjectId,
  ): Promise<Workspace> {
    const workspaceData = await this.workspaceReposistory.get(id);
    if (workspaceData) {
      for (const item of workspaceData.users) {
        if (
          item.id.toString() === userId.toString() &&
          (item.role === WorkspaceRole.ADMIN ||
            item.role === WorkspaceRole.EDITOR)
        ) {
          return workspaceData;
        }
      }
      throw new BadRequestException("You don't have access for this Workspace");
    }
    throw new NotFoundException("Workspace doesn't exist");
  }

  async createTestflowSchedular(
    schedularData: CreateTestflowSchedularDto,
    user: DecodedUserObject,
  ) {
    try {
      const workspaceUsers = await this.workspaceReposistory.get(
        schedularData?.workspaceId,
      );
      if (!workspaceUsers) {
        throw new NotFoundException("Workspace not found.");
      }
      const userDetails = workspaceUsers.users.find(
        (item) => item.id === user._id.toString(),
      );
      if (!userDetails) {
        throw new NotFoundException("User not found in workspace.");
      }
      if (
        userDetails.role !== WorkspaceRole.ADMIN &&
        userDetails.role !== WorkspaceRole.EDITOR
      ) {
        throw new ForbiddenException(
          "User does not have permission to perform this action.",
        );
      }
      const testflowDetails = await this.testflowRepository.get(schedularData.testflowId);
      // Build cron config
      const runCycleConfig = this.buildRunCycleConfig(
        schedularData.runConfiguration,
      );
      // Generate schedulerId, jobName & cron expression
      const schedulerId = uuidv4();
      const jobName = `scheduler_${schedulerId}`;
      const cronExpression = this.generateCronExpression(runCycleConfig);
      if (!cronExpression) {
        throw new BadRequestException("Invalid run cycle configuration");
      }
      // Save scheduler details in DB
      const newSchedular: TestflowSchedular = {
        id: schedulerId,
        name: schedularData.name,
        environmentId: schedularData.environmentId,
        runConfiguration: schedularData.runConfiguration,
        notification: schedularData.notification,
        isActive: true,
        cronExpression,
        nodes:testflowDetails?.nodes,
        edges:testflowDetails?.edges,
        schedularName: jobName,
        executedCount: 0,
        lastExecuted: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: user._id.toString(),
        updatedBy: user._id.toString(),
      };
      await this.testflowRepository.addSchedular(
        schedularData.testflowId,
        newSchedular,
      );
      //Register cron job
      const jobAdded = await this.testflowSchedulerService.addSchedulerJob(
        runCycleConfig,
        this.getScheduledExecutionCallback(
          schedularData.testflowId,
          schedularData.environmentId,
          schedularData.workspaceId,
          schedulerId,
          user,
        ),
        jobName,
        cronExpression,
        schedulerId,
      );
      if (!jobAdded) {
        throw new BadRequestException("Failed to register cron job");
      }
      return {
        success: true,
        message: "Scheduler created successfully",
        data: newSchedular,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to create scheduler: ${error.message}`,
      );
    }
  }

  public buildRunCycleConfig(runConfig: RunConfigurationDto): RunCycleConfig {
    switch (runConfig.runCycle) {
      case RunCycleEnum.ONCE:
        if (!runConfig.executeAt) {
          throw new BadRequestException(
            "executeAt is required for ONCE run cycle",
          );
        }
        return {
          type: RunCycleEnum.ONCE,
          executeAt: new Date(runConfig.executeAt),
        };

      case RunCycleEnum.DAILY:
        if (!runConfig.time) {
          throw new BadRequestException("time is required for DAILY run cycle");
        }
        const dailyTime = this.parseTime(runConfig.time);
        return {
          type: RunCycleEnum.DAILY,
          time: dailyTime,
        };

      case RunCycleEnum.HOURLY:
        if (!runConfig.intervalHours) {
          throw new BadRequestException(
            "intervalHours is required for HOURLY run cycle",
          );
        }
        return {
          type: RunCycleEnum.HOURLY,
          intervalHours: runConfig.intervalHours,
          startTime: runConfig.time
            ? this.parseTime(runConfig.time)
            : undefined,
        };

      case RunCycleEnum.WEEKLY:
        if (!runConfig.days || runConfig.days.length === 0) {
          throw new BadRequestException(
            "days array is required for WEEKLY run cycle",
          );
        }
        if (!runConfig.time) {
          throw new BadRequestException(
            "time is required for WEEKLY run cycle",
          );
        }
        const weeklyTime = this.parseTime(runConfig.time);
        return {
          type: RunCycleEnum.WEEKLY,
          days: runConfig.days,
          time: weeklyTime,
        };

      default:
        throw new BadRequestException(
          `Unsupported run cycle type: ${runConfig.runCycle}`,
        );
    }
  }

  private parseTime(timeString: string): {
    hour: number;
    minute: number;
    second: number;
  } {
    const timeRegex = /^(\d{2}):(\d{2})$/;
    const match = timeString.match(timeRegex);
    if (!match) {
      throw new BadRequestException(
        `Invalid time format: ${timeString}. Expected HH:mm format.`,
      );
    }
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    if (hour < 0 || hour > 23) {
      throw new BadRequestException(
        `Invalid hour: ${hour}. Must be between 0-23.`,
      );
    }
    if (minute < 0 || minute > 59) {
      throw new BadRequestException(
        `Invalid minute: ${minute}. Must be between 0-59.`,
      );
    }
    return {
      hour,
      minute,
      second: 0,
    };
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

  public getScheduledExecutionCallback(
    testflowId: string,
    environmentId: string,
    workspaceId: string,
    schedulerId: string,
    user?: DecodedUserObject,
  ) {
    return async () => {
      await this.executeTestflow(
        testflowId,
        environmentId,
        workspaceId,
        schedulerId,
        user,
      );
    };
  }

  // Updated executeTestflow method
  private async executeTestflow(
    testflowId: string,
    environmentId: string,
    workspaceId: string,
    schedulerId: string,
    user?: DecodedUserObject,
  ) {
    try {
      const response = await this.testflowRunService.handleTestFlowRun(
        testflowId,
        schedulerId,
        environmentId,
        workspaceId,
        user,
      );
      //Save execution result in DB
      await this.testflowRepository.updateSchedularExecution(
        testflowId,
        schedulerId,
        response.result.history,
      );
      const getSchedular = await this.testflowRepository.getSchedularById(
        testflowId,
        schedulerId,
      );
      if (getSchedular.runConfiguration.runCycle === RunCycleEnum.ONCE) {
        await this.testflowRepository.updateSchedularStatus(
          testflowId,
          schedulerId,
          false,
        );
      }
      const data = response.result.history;
      let scheduleRunResult;
      if (data.status === "fail" && data.successRequests < 1) {
        scheduleRunResult = "failed";
      } else if (data.status === "success") {
        scheduleRunResult = "success";
      } else {
        scheduleRunResult = "partial";
      }
      const totalRequestCount = data.successRequests + data.failedRequests;
      const userDetails = await this.userReposistory.getUserById(data.createdBy);
      const successPercentage =
        (data.successRequests / totalRequestCount) * 100;
      const emailData: EmailData = {
        userName: userDetails?.name,
        scheduleName: getSchedular.name,
        scheduleLastestRun: new Date(getSchedular.lastExecuted),
        scheduleRunResult: scheduleRunResult,
        scheduleRunPassedCount: data.successRequests,
        scheduleRunFailedCount: data.failedRequests,
        scheduleRunTotalRequest: data.successRequests + data.failedRequests,
        scheduleRunPassPercentage: successPercentage,
        scheduleTotalTime: data.totalTime,
        scheduleRunEnvName: response.environmentName,
        isSuccess: data.successRequests === totalRequestCount,
        isFailed: data.successRequests === 0,
        isPartial: data.successRequests > 0 && data.successRequests < totalRequestCount
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
      if (getSchedular.runConfiguration.runCycle === RunCycleEnum.ONCE) {
        await this.testflowRepository.updateSchedularStatus(
          testflowId,
          schedulerId,
          false,
        );
      }
    } catch (err) {
      console.error(
        `Error executing testflow for scheduler ${schedulerId}:`,
        err,
      );
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
}
