// ---- Libraries
import {
  BadRequestException,
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
  UpdateTestflowDto,
} from "../payloads/testflow.payload";
import { Testflow } from "@src/modules/common/models/testflow.model";
import { DecodedUserObject } from "@src/types/fastify";

/**
 * Testflow Service
 */
@Injectable()
export class TestflowService {
  constructor(
    private readonly testflowRepository: TestflowRepository,
    private readonly workspaceReposistory: WorkspaceRepository,
    private readonly producerService: ProducerService,
    private readonly workspaceService: WorkspaceService,
  ) {}

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
    const testflows = [];
    for (let i = 0; i < workspace.testflows?.length; i++) {
      const testflow = await this.testflowRepository.get(
        workspace.testflows[i].id.toString(),
      );
      testflows.push(testflow);
    }
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
    const testflows = [];
    for (let i = 0; i < workspace.testflows?.length; i++) {
      const testflow = await this.testflowRepository.get(
        workspace.testflows[i].id.toString(),
      );
      testflows.push(testflow);
    }
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
}
