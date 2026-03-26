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
  TestflowValidationResultDto,
} from "../payloads/testflow.payload";
import {
  RunConfigurationDto,
  Testflow,
  TestflowDataSetItem,
  TestflowDataSetRunHistoryRequest,
  TestflowEdges,
  TestflowNodes,
  TestflowSchedular,
  TestflowSchedularDataSetHistory,
  TestFlowSchedularRunHistory,
} from "@src/modules/common/models/testflow.model";
import { BodyModeEnum } from "@src/modules/common/models/collection.model";
import { DecodedUserObject } from "@src/types/fastify";
import { v4 as uuidv4 } from "uuid";
import { TestflowSchedulerService } from "./testflow-schedular.service";
import {
  DailyConfig,
  DatasetSummaryItem,
  DayOfWeek,
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
import { EnvironmentRepository } from "../repositories/environment.repository";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { TeamRepository } from "@src/modules/identity/repositories/team.repository";
import { UserMetricsService } from "./userMetrics.service";

/**
 * Testflow Service
 */
@Injectable()
export class TestflowService implements OnModuleInit {
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
    private readonly userReposistory: UserRepository,
    private readonly environmentReposistory: EnvironmentRepository,
    private readonly teamReposistory: TeamRepository,
    private readonly userMetricsService: UserMetricsService,
  ) {}

  async getNextFutureCronExpression(
    pastCron: string,
    intervalHours: number,
  ): Promise<string> {
    // Expecting cron in format: 's m h * * *'
    const parts = pastCron.trim().split(/\s+/);
    if (parts.length !== 6) return pastCron;

    const second = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    const hour = parseInt(parts[2], 10);
    const day = parseInt(parts[3], 10);
    const month = parseInt(parts[4], 10) - 1;

    // Start from the past time
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), month, day, hour, minute, second, 0),
    );

    // If the past time is in the past, keep adding interval until it's in the future
    while (next <= now) {
      next.setUTCHours(next.getUTCHours() + intervalHours);
    }

    // Return new cron expression
    return `${next.getUTCSeconds()} ${next.getUTCMinutes()} ${next.getUTCHours()} ${next.getUTCDate()} ${next.getUTCMonth() + 1} *`;
  }

  async onModuleInit() {
    try {
      this.logger.log("Bootstrapping schedulers from DB...");
      const testflows = await this.testflowRepository.getAll();
      if (testflows.length === 0) {
        this.logger.log("No testflows found — skipping scheduler bootstrap.");
        return;
      }
      for (const tf of testflows) {
        if (!tf.schedules?.length) continue;

        for (const schedule of tf.schedules) {
          try {
            const runCycleConfig = this.buildRunCycleConfig(
              schedule.runConfiguration,
            );
            if (schedule.isActive && schedule.cronExpression) {
              let cronExpression = schedule.cronExpression;
              if (schedule.runConfiguration.runCycle === RunCycleEnum.HOURLY) {
                const intervalHours = schedule.runConfiguration.intervalHours;
                cronExpression = await this.getNextFutureCronExpression(
                  cronExpression,
                  intervalHours,
                );
              }
              await this.testflowSchedulerService.addSchedulerJob(
                runCycleConfig,
                this.getScheduledExecutionCallback(
                  tf._id.toString(),
                  schedule.environmentId,
                  tf.workspaceId,
                  schedule.id,
                  schedule.testflowDataSetId,
                ),
                (_cronExpression: string) => {
                  this.testflowRepository.editSchedular(
                    tf._id.toString(),
                    schedule.id,
                    {
                      cronExpression: _cronExpression,
                    },
                  );
                },
                cronExpression,
                schedule.id,
                "UTC",
              );
            }
          } catch (error) {
            this.logger.error("Error adding scheduler job:", error);
          }
        }
      }
    } catch (error) {
      this.logger.error("Error during scheduler bootstrap:", error);
    }
  }

  /**
   * Delete a run history entry for a schedule in a testflow
   */
  async deleteScheduleRunHistory(
    workspaceId: string,
    testflowId: string,
    scheduleId: string,
    runHistoryId: string,
    user: DecodedUserObject,
  ) {
    // Permission check (admin or editor)
    await this.isWorkspaceAdminorEditor(workspaceId, user._id);
    // Remove the run history entry from the schedule
    return this.testflowRepository.removeSchedularRunHistory(
      testflowId,
      scheduleId,
      runHistoryId,
      user._id,
    );
  }

  /**
   * Delete a run history entry for a schedule in a testflow
   */
  async deleteScheduleRunHistoryTestData(
    workspaceId: string,
    testflowId: string,
    scheduleId: string,
    runHistoryTestDataId: string,
    user: DecodedUserObject,
  ) {
    // Permission check (admin or editor)
    await this.isWorkspaceAdminorEditor(workspaceId, user._id);
    // Remove the run history entry from the schedule
    return this.testflowRepository.removeSchedularRunHistoryTestData(
      testflowId,
      scheduleId,
      runHistoryTestDataId,
      user._id,
    );
  }

  /**
   * Update a specific schedule for a testflow.
   */
  async updateTestflowSchedule(
    testflowId: string,
    scheduleId: string,
    updateScheduleDto: Partial<TestflowSchedular>,
    workspaceId: string,
    user: DecodedUserObject,
  ) {
    // Permission check
    await this.isWorkspaceAdminorEditor(workspaceId, user._id);
    // Fetch existing schedule
    const existingSchedular = await this.testflowRepository.getSchedularById(
      testflowId,
      scheduleId,
    );
    if (!existingSchedular) {
      throw new NotFoundException("Schedule not found");
    }

    let environmentName = "";
    if (updateScheduleDto?.environmentId) {
      const environmentData = await this.environmentReposistory.get(
        updateScheduleDto?.environmentId,
      );
      environmentName = environmentData?.name || "";
    }

    if (updateScheduleDto.runConfiguration) {
      const runCycleConfig = this.buildRunCycleConfig(
        updateScheduleDto.runConfiguration,
      );
      const cronExpression = this.generateCronExpression(runCycleConfig);
      if (!cronExpression) {
        updateScheduleDto.cronExpression = null;
      } else {
        updateScheduleDto.cronExpression = cronExpression;
      }
    } else {
      if (existingSchedular.runConfiguration.runCycle === RunCycleEnum.HOURLY) {
        const runCycleConfig = this.buildRunCycleConfig(
          existingSchedular.runConfiguration,
        );
        const cronExpression = this.generateCronExpression(runCycleConfig);
        if (!cronExpression) {
          updateScheduleDto.cronExpression = null;
        } else {
          updateScheduleDto.cronExpression = cronExpression;
        }
      }
    }

    // Merge update fields, ensure id is present
    const updatedSchedular: TestflowSchedular = {
      ...existingSchedular,
      ...updateScheduleDto,
      environmentName: environmentName,
      id: existingSchedular.id,
      updatedAt: new Date(),
      updatedBy: user._id.toString(),
    };
    // Update schedule in DB
    const result = await this.testflowRepository.updateSchedular(
      testflowId,
      scheduleId,
      updatedSchedular,
    );

    const schedular = await this.testflowRepository.getSchedularById(
      testflowId,
      scheduleId,
    );
    if (schedular) {
      // Remove old job
      await this.testflowSchedulerService.removeSchedulerJob(scheduleId);
      // If still active, re-add job
      if (schedular.isActive) {
        const runCycleConfig = this.buildRunCycleConfig(
          schedular.runConfiguration,
        );
        const cronExpression = schedular.cronExpression;
        await this.testflowSchedulerService.addSchedulerJob(
          runCycleConfig,
          this.getScheduledExecutionCallback(
            testflowId,
            schedular.environmentId,
            workspaceId,
            scheduleId,
            schedular.testflowDataSetId,
            user,
          ),
          (_cronExpression: string) => {
            this.testflowRepository.editSchedular(testflowId, scheduleId, {
              cronExpression: _cronExpression,
            });
          },
          cronExpression,
          scheduleId,
          "UTC",
        );
      }
    }

    return result;
  }

  /**
   * Delete a specific schedule from a testflow.
   */
  async deleteTestflowSchedule(
    testflowId: string,
    scheduleId: string,
    workspaceId: string,
    user: DecodedUserObject,
  ) {
    await this.isWorkspaceAdminorEditor(workspaceId, user._id);
    // Remove schedule from DB
    const result = await this.testflowRepository.removeSchedular(
      testflowId,
      scheduleId,
      user._id,
    );
    // Remove cron job
    await this.testflowSchedulerService.removeSchedulerJob(scheduleId);
    return result;
  }

  /**
   * Manually run a testflow schedule.
   */
  async runTestflowSchedule(
    testflowId: string,
    scheduleId: string,
    workspaceId: string,
    testflowDataSetId: string,
    user: DecodedUserObject,
  ) {
    await this.isWorkspaceAdminorEditor(workspaceId, user._id);
    const schedular = await this.testflowRepository.getSchedularById(
      testflowId,
      scheduleId,
    );
    if (!schedular) {
      throw new NotFoundException("Schedule not found");
    }
    // Run the testflow immediately
    await this.executeTestflow(
      testflowId,
      schedular.environmentId,
      workspaceId,
      scheduleId,
      false,
      testflowDataSetId,
      user,
    );
    return { success: true, message: "Schedule run triggered" };
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
    // Fire-and-forget: track testflow creation as an execution metric
    try {
      if (user && user._id) {
        const userIdStr =
          typeof user._id === "string" ? user._id : user._id.toString();
        this.userMetricsService.onTestflowExecuted(userIdStr);
      }
    } catch (err) {
      // swallow errors - metric tracking must not block the flow
      this.logger.warn(
        `userMetrics onTestflowExecuted failed: ${err?.message || err}`,
      );
    }

    return testflow;
  }

  /**
   * Fetches single testflow.
   * @param id - Testflow id you want to fetch.
   */
  async getTestflow(
    workspaceId: string,
    testflowId: string,
    userId: ObjectId,
  ): Promise<WithId<Testflow>> {
    await this.checkPermission(workspaceId, userId);
    return await this.testflowRepository.get(testflowId);
  }

  /**
   * Fetches single testflow.
   * @param id - Testflow id you want to fetch.
   */
  async getTestflowDataSets(
    workspaceId: string,
    testflowId: string,
    userId: ObjectId,
  ): Promise<{ datasets?: TestflowDataSetItem[] }> {
    await this.checkPermission(workspaceId, userId);
    const response = await this.testflowRepository.get(testflowId);
    if (!response) {
      throw new NotFoundException(`Testflow not found for ID: ${testflowId}`);
    }
    // Only return the datasets field
    const updatedResponse = {
      datasets: response?.datasets ?? [],
      workspaceId,
      testflowId,
    };
    return updatedResponse;
  }

  /**
   * Checks permissions to user with their workspace.
   * @param workspaceId - Workspace id.
   * @param userid - User id to match with workspace.
   */
  async checkPermission(workspaceId: string, userid: ObjectId): Promise<void> {
    const workspace = await this.workspaceService.get(workspaceId);
    if (workspace.workspaceType === WorkspaceType.PUBLIC) {
      return;
    }
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

    // Remove all associated cronjobs for this testflow
    if (testflow?.schedules && Array.isArray(testflow.schedules)) {
      for (const schedule of testflow.schedules) {
        if (schedule?.id) {
          await this.testflowSchedulerService.removeSchedulerJob(schedule.id);
        }
      }
    }

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
    let testflowIds = workspace.testflows?.map((t) => t.id.toString()) || [];
    const teamId = workspace.team.id;
    const getTeamData = await this.teamReposistory.get(teamId);
    if (getTeamData) {
      const testflowLimit = getTeamData.plan.limits.testflowPerWorkspace.value;
      testflowIds = testflowIds.slice(0, testflowLimit);
    }
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
    let testflowIds = workspace.testflows?.map((t) => t.id.toString()) || [];
    const teamId = workspace.team.id;
    const getTeamData = await this.teamReposistory.get(teamId);
    if (getTeamData) {
      const testflowLimit = getTeamData.plan.limits.testflowPerWorkspace.value;
      testflowIds = testflowIds.slice(0, testflowLimit);
    }
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
      await this.isWorkspaceAdminorEditor(schedularData?.workspaceId, user._id);
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
      let environmentName = "";
      if (schedularData?.environmentId) {
        const environmentData = await this.environmentReposistory.get(
          schedularData?.environmentId,
        );
        environmentName = environmentData?.name || "";
      }
      let getTestflowDataSet: TestflowDataSetItem | null = null;
      if (schedularData?.testflowDataSetId) {
        getTestflowDataSet = await this.testflowRepository.getDataset(
          schedularData.testflowId,
          schedularData?.testflowDataSetId,
        );
      }
      // Save scheduler details in DB
      const newSchedular: TestflowSchedular = {
        id: schedulerId,
        name: schedularData.name,
        environmentId: schedularData.environmentId,
        environmentName: environmentName,
        runConfiguration: schedularData.runConfiguration,
        notification: schedularData.notification,
        isActive: true,
        cronExpression,
        testflowDataSetId: schedularData?.testflowDataSetId || "",
        testflowDataSetName: getTestflowDataSet?.name ?? "",
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
          schedularData.testflowDataSetId,
          user,
        ),
        (_cronExpression: string) => {
          this.testflowRepository.editSchedular(
            schedularData.testflowId,
            schedulerId,
            {
              cronExpression: _cronExpression,
            },
          );
        },
        cronExpression,
        schedulerId,
        "UTC",
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
          executeAt: new Date(Date.now() + 1 * 60 * 1000),
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

  private parseTime(utcTimeString: string): {
    hour: number;
    minute: number;
    second: number;
  } {
    const date = new Date(utcTimeString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(
        `Invalid UTC datetime: ${utcTimeString}. Expected ISO 8601 format like 2025-10-06T10:51:00Z.`,
      );
    }
    return {
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
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
    const second = executeAt.getUTCSeconds();
    const minute = executeAt.getUTCMinutes();
    const hour = executeAt.getUTCHours();
    const dayOfMonth = executeAt.getUTCDate();
    const month = executeAt.getUTCMonth() + 1;
    return `${second} ${minute} ${hour} ${dayOfMonth} ${month} *`;
  }

  private generateDailyCronExpression(config: DailyConfig): string {
    const { hour, minute, second = 0 } = config.time;
    return `${second} ${minute} ${hour} * * *`;
  }

  private generateHourlyCronExpression(config: HourlyConfig): string {
    const executeAt = config.executeAt;
    const now = new Date();
    if (executeAt <= now) {
      return null;
    }
    const second = executeAt.getUTCSeconds();
    const minute = executeAt.getUTCMinutes();
    const hour = executeAt.getUTCHours();
    const dayOfMonth = executeAt.getUTCDate();
    const month = executeAt.getUTCMonth() + 1;
    return `${second} ${minute} ${hour} ${dayOfMonth} ${month} *`;
  }

  private generateWeeklyCronExpression(config: WeeklyConfig): string {
    const { days, time } = config;
    const { hour, minute, second = 0 } = time;
    const validDays = days.filter((day) => {
      return day >= DayOfWeek.SUNDAY && day <= DayOfWeek.SATURDAY;
    });
    if (validDays.length === 0) {
      throw new BadRequestException(
        "Invalid days specified. Days must be valid DayOfWeek values (0=Sunday, 1=Monday, ..., 6=Saturday)",
      );
    }
    const sortedDays = validDays.sort((a, b) => a - b);
    const daysString = sortedDays.join(",");
    return `${second} ${minute} ${hour} * * ${daysString}`;
  }

  public getScheduledExecutionCallback(
    testflowId: string,
    environmentId: string,
    workspaceId: string,
    schedulerId: string,
    testflowDataSetId: string,
    user?: DecodedUserObject,
  ) {
    return async () => {
      await this.executeTestflow(
        testflowId,
        environmentId,
        workspaceId,
        schedulerId,
        true,
        testflowDataSetId,
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
    isScheduled: boolean,
    testflowDataSetId: string,
    user?: DecodedUserObject,
  ) {
    try {
      if (!testflowDataSetId) {
        await this.executeTestflowWithOutDatSet(
          testflowId,
          environmentId,
          workspaceId,
          schedulerId,
          isScheduled,
          user,
        );
      } else {
        await this.executeTestflowWithDataset(
          testflowId,
          environmentId,
          workspaceId,
          schedulerId,
          isScheduled,
          testflowDataSetId,
          user,
        );
      }
    } catch (err) {
      console.error(
        `Error executing testflow for scheduler ${schedulerId}:`,
        err,
      );
    }
  }

  private async executeTestflowWithOutDatSet(
    testflowId: string,
    environmentId: string,
    workspaceId: string,
    schedulerId: string,
    isScheduled: boolean,
    user?: DecodedUserObject,
  ) {
    try {
      const uuid = uuidv4();
      const runningHistory: TestFlowSchedularRunHistory = {
        id: uuid,
        isScheduled,
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
      //Save execution result in DB
      await this.testflowRepository.updateSchedularExecution(
        testflowId,
        schedulerId,
        runningHistory,
      );
      const response = await this.testflowRunService.handleTestFlowRun(
        environmentId,
        workspaceId,
        testflowId,
        user,
      );
      const executedHistory = {
        id: uuid,
        isScheduled,
        nodes: response.nodes,
        edges: response.edges,
        ...response.result.history,
        status: response?.result?.history?.status || "error",
      };
      //Save execution result in DB
      await this.testflowRepository.editSchedularExecution(
        testflowId,
        schedulerId,
        executedHistory,
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
      const data = response?.result?.history;
      let scheduleRunResult;
      if (!response?.status) {
        scheduleRunResult = "error";
      } else if (data?.status === "fail" && data?.successRequests < 1) {
        scheduleRunResult = "failed";
      } else if (data?.status === "success") {
        scheduleRunResult = "success";
      } else if (data?.status === "error") {
        scheduleRunResult = "error";
      } else {
        scheduleRunResult = "partial";
      }
      const totalRequestCount = data.successRequests + data.failedRequests;
      const userDetails = await this.userReposistory.getUserById(
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
      if (getSchedular.runConfiguration.runCycle === RunCycleEnum.ONCE) {
        await this.testflowRepository.updateSchedularStatus(
          testflowId,
          schedulerId,
          false,
        );
      }
    } catch (err) {
      console.error(`Error executing testflow without dataset:`, err);
    }
  }

  private async executeTestflowWithDataset(
    testflowId: string,
    environmentId: string,
    workspaceId: string,
    schedulerId: string,
    isScheduled: boolean,
    testflowDataSetId: string,
    user?: DecodedUserObject,
  ) {
    try {
      const uuid = uuidv4();
      const runningHistory: TestflowSchedularDataSetHistory = {
        id: uuid,
        isScheduled,
        status: "pending",
        schedularDataRunHistory: [],
        createdAt: new Date(),
      };

      // Add initial pending history
      await this.testflowRepository.updateSchedularDataSetExecution(
        testflowId,
        schedulerId,
        runningHistory,
      );
      // Execute testflow with dataset
      const dataSetResults =
        await this.testflowRunService.handleTestflowDataSetRun(
          environmentId,
          workspaceId,
          testflowId,
          testflowDataSetId,
          user,
        );
      // Transform each dataset result into TestflowDataSetRunHistoryRequest format
      const schedularDataRunHistory: TestflowDataSetRunHistoryRequest[] =
        dataSetResults.map((dataSetResult: any) => {
          const history = dataSetResult.result?.history || {};

          return {
            failedRequests: history.failedRequests || 0,
            requests: history.requests || [],
            responses: history.responses || [],
            status: history.status || "error",
            successRequests: history.successRequests || 0,
            totalTime: history.totalTime || "0ms",
          };
        });
      const aggregatedHistory = dataSetResults.reduce(
        (acc: any, dataSetResult: any) => {
          const history = dataSetResult.result?.history || {};

          acc.failedRequests += history.failedRequests || 0;
          acc.successRequests += history.successRequests || 0;
          acc.totalRequests +=
            (history.failedRequests || 0) + (history.successRequests || 0);

          // Accumulate duration if available
          if (history.totalTime) {
            const timeStr = history.totalTime.toString().trim();
            let timeInMs = 0;
            if (timeStr.endsWith("sec")) {
              const seconds = parseFloat(timeStr.replace("sec", "").trim());
              timeInMs = isNaN(seconds) ? 0 : seconds * 1000;
            } else if (timeStr.endsWith("ms")) {
              const ms = parseFloat(timeStr.replace("ms", "").trim());
              timeInMs = isNaN(ms) ? 0 : ms;
            }
            acc.totalTimeMs += timeInMs;
          }

          return acc;
        },
        {
          failedRequests: 0,
          successRequests: 0,
          totalRequests: 0,
          totalTimeMs: 0,
        },
      );
      // Build datasetSummary array from dataSetResults
      const datasetSummary: DatasetSummaryItem[] = dataSetResults.map(
        (dataSetResult: any, index: number) => {
          const history = dataSetResult.result?.history || {};

          const passedCount = history.successRequests || 0;
          const failedCount = history.failedRequests || 0;
          const requestCount = passedCount + failedCount;
          const duration = history.totalTime;
          return {
            datasetName: `Dataset ${index + 1}`,
            requestCount,
            passedCount,
            failedCount,
            duration,
          };
        },
      );

      // Convert total time back to a readable format
      const averageTime =
        aggregatedHistory.totalRequests > 0
          ? `${(aggregatedHistory.totalTimeMs / 1000).toFixed(2)} sec`
          : "0 sec";

      // Derive overall status
      let scheduleRunResult: string;
      if (
        aggregatedHistory.successRequests === 0 &&
        aggregatedHistory.failedRequests > 0
      ) {
        scheduleRunResult = "failed";
      } else if (
        aggregatedHistory.failedRequests === 0 &&
        aggregatedHistory.successRequests > 0
      ) {
        scheduleRunResult = "success";
      } else if (
        aggregatedHistory.failedRequests > 0 &&
        aggregatedHistory.successRequests > 0
      ) {
        scheduleRunResult = "partial";
      } else {
        scheduleRunResult = "error";
      }

      const totalRequestCount =
        aggregatedHistory.successRequests + aggregatedHistory.failedRequests;

      const successPercentage =
        totalRequestCount > 0
          ? Math.round(
              (aggregatedHistory.successRequests / totalRequestCount) *
                100 *
                100,
            ) / 100
          : 0;

      // Determine overall status based on all dataset results
      const hasError = schedularDataRunHistory.some(
        (h) => h.status === "error",
      );
      const hasFailure = schedularDataRunHistory.some(
        (h) => h.status === "fail",
      );
      const overallStatus = hasError ? "error" : hasFailure ? "fail" : "pass";

      // Prepare the executed history with all dataset run results
      const executedHistory: Partial<TestflowSchedularDataSetHistory> = {
        id: uuid,
        isScheduled,
        schedularDataRunHistory,
        nodes: dataSetResults[0].nodes,
        edges: dataSetResults[0].edges,
        status: overallStatus,
        updatedAt: new Date(),
      };
      // Update execution result in DB
      await this.testflowRepository.editSchedularDataSetHistory(
        testflowId,
        schedulerId,
        executedHistory,
      );
      const getSchedular = await this.testflowRepository.getSchedularById(
        testflowId,
        schedulerId,
      );
      const userDetails = await this.userReposistory.getUserById(
        user._id.toString(),
      );
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
        scheduleRunPassedCount: aggregatedHistory.successRequests,
        scheduleRunFailedCount: aggregatedHistory.failedRequests,
        scheduleRunTotalRequest: aggregatedHistory.totalRequests,
        scheduleRunPassPercentage: successPercentage.toString(),
        scheduleTotalTime: averageTime,
        scheduleRunEnvName: getSchedular.environmentName,
        isSuccess: aggregatedHistory.successRequests === totalRequestCount,
        isFailed: aggregatedHistory.successRequests === 0,
        isPartial:
          aggregatedHistory.successRequests > 0 &&
          aggregatedHistory.successRequests < totalRequestCount,
        testflowDataSummary: datasetSummary,
      };
      if (
        getSchedular.notification.receiveNotifications ===
        NotificationReceiveType.FAILURE
      ) {
        if (overallStatus === "fail") {
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
      return;
    } catch (error) {
      console.error(`Error executing testflow with dataset:`, error);
    }
  }

  /**
   * Validates testflow nodes for localhost URLs and formdata files
   * @param workspaceId - The workspace ID
   * @param testflowId - The testflow ID
   * @param userId - The user ID for permission check
   * @returns Validation results containing flags and detailed node information
   */
  async validateTestflowNodes(
    workspaceId: string,
    testflowId: string,
    userId: ObjectId,
  ): Promise<TestflowValidationResultDto> {
    // Check permissions
    await this.checkPermission(workspaceId, userId);

    // Get the testflow
    const testflow = await this.testflowRepository.get(testflowId);

    const localhostNodes: Array<{
      nodeId: string;
      blockName: string;
      url: string;
    }> = [];

    const formdataNodes: Array<{
      nodeId: string;
      blockName: string;
      fileCount: number;
    }> = [];

    // Validate each node
    if (testflow.nodes && Array.isArray(testflow.nodes)) {
      for (const node of testflow.nodes) {
        if (!node.data) continue;

        const { blockName = "Unnamed Block", requestData } = node.data;

        // Check for localhost URLs by examining hostname only
        if (requestData?.url) {
          try {
            const url = new URL(requestData.url.trim());
            const hostname = url.hostname.toLowerCase();

            const localhostPatterns = [
              "localhost",
              "127.0.0.1",
              "0.0.0.0",
              "::1", // IPv6 localhost
            ];

            // Check for private IP ranges
            const isPrivateIP =
              hostname.startsWith("192.168.") ||
              hostname.startsWith("10.") ||
              (hostname.startsWith("172.") &&
                (() => {
                  const parts = hostname.split(".");
                  if (parts.length >= 2) {
                    const secondOctet = parseInt(parts[1], 10);
                    return secondOctet >= 16 && secondOctet <= 31;
                  }
                  return false;
                })()) ||
              hostname.endsWith(".local") ||
              hostname.includes(".local.");

            const isLocalhost =
              localhostPatterns.includes(hostname) || isPrivateIP;

            if (isLocalhost) {
              localhostNodes.push({
                nodeId: node.id,
                blockName,
                url: requestData.url,
              });
            }
          } catch (error) {}
        }

        // Check for formdata files
        if (
          requestData?.selectedRequestBodyType ===
            BodyModeEnum["multipart/form-data"] &&
          requestData?.body?.formdata?.text
        ) {
          const files = requestData.body.formdata.text.filter((formData) => {
            if (formData.type === "file") {
              return true;
            } else {
              return false;
            }
          });
          const fileCount = Array.isArray(files) ? files.length : 0;

          if (fileCount > 0) {
            formdataNodes.push({
              nodeId: node.id,
              blockName,
              fileCount,
            });
          }
        }
      }
    }

    return {
      hasLocalhostUrls: localhostNodes.length > 0,
      hasFormdataFiles: formdataNodes.length > 0,
      localhostNodes,
      formdataNodes,
    };
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
    const hubUrlLink = `${this.configService.get("sparrowApp.baseUrl")}/app/collections`;
    // Merge emailData
    const context = {
      sparrowEmail: this.configService.get("support.sparrowEmail"),
      sparrowWebsite: this.configService.get("support.sparrowWebsite"),
      sparrowWebsiteName: this.configService.get("support.sparrowWebsiteName"),
      authUrl: this.configService.get("auth.baseURL"),
      hubUrl: hubUrlLink,
      ...emailData,
    };
    const promises: Promise<any>[] = [];
    for (const email of emails) {
      if (!email?.trim()) continue;
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: email.trim(),
        text: "Testflow Run Report",
        template: emailData?.testflowDataSummary
          ? "testflowScheduleDataSetEmail"
          : "testflowScheduleRunEmail",
        context,
        subject: `Sparrow Test Report`,
      };
      promises.push(this.emailService.sendEmail(transporter, mailOptions));
    }
    await Promise.all(promises);
  }
}
