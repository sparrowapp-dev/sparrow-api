import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";
import { ContextService } from "@src/modules/common/services/context.service";
import {
  CreateEnvironmentDto,
  UpdateEnvironmentDto,
} from "../payloads/environment.payload";
import {
  Environment,
  EnvironmentType,
} from "@src/modules/common/models/environment.model";
import { EnvironmentRepository } from "../repositories/environment.repository";
import { ErrorMessages } from "@src/modules/common/enum/error-messages.enum";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import { Workspace } from "@src/modules/common/models/workspace.model";
import { WorkspaceRole } from "@src/modules/common/enum/roles.enum";

/**
 * Environment Service
 */

@Injectable()
export class EnvironmentService {
  constructor(
    private readonly environmentRepository: EnvironmentRepository,
    private readonly workspaceReposistory: WorkspaceRepository,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Creates new environment.
   * @param createEnvironmentDto - Environment object to be inserted.
   * @param type - Can be GLOBAL or LOCAL
   */
  async createEnvironment(
    createEnvironmentDto: CreateEnvironmentDto,
    type: EnvironmentType,
  ): Promise<InsertOneResult> {
    try {
      const user = this.contextService.get("user");

      if (type === EnvironmentType.LOCAL) {
        await this.isWorkspaceAdminorEditor(createEnvironmentDto.workspaceId);
      }

      const newEnvironment: Environment = {
        name: createEnvironmentDto.name,
        variable: createEnvironmentDto.variable,
        type,
        createdBy: user.name,
        updatedBy: user.name,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const environment = await this.environmentRepository.addEnvironment(
        newEnvironment,
      );
      return environment;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  /**
   * Fetches single environment.
   * @param id - Environment id you want to fetch.
   */
  async getEnvironment(id: string): Promise<WithId<Environment>> {
    return await this.environmentRepository.get(id);
  }

  /**
   * Checks permissions to user with their workspace.
   * @param workspaceId - Workspace id.
   * @param userid - User id to match with workspace.
   */
  async checkPermission(workspaceId: string, userid: ObjectId): Promise<void> {
    const workspace = await this.workspaceReposistory.get(workspaceId);
    const hasPermission = workspace.users.some((user) => {
      return user.id.toString() === userid.toString();
    });
    if (!hasPermission) {
      throw new UnauthorizedException(ErrorMessages.Unauthorized);
    }
  }

  /**
   * Deletes an existing environment.
   * @param id - Environment id you want to delete.
   * @param workspaceId - Workspace id you want to delete from it.
   */
  async deleteEnvironment(
    id: string,
    workspaceId: string,
  ): Promise<DeleteResult> {
    await this.isWorkspaceAdminorEditor(workspaceId);
    const data = await this.environmentRepository.delete(id);
    return data;
  }

  /**
   * Fetches all the environment corresponding to a workspace.
   * @param id - Workspace id you want to get their environments.
   */
  async getAllEnvironments(id: string): Promise<WithId<Environment>[]> {
    const user = this.contextService.get("user");
    await this.checkPermission(id, user._id);

    const workspace = await this.workspaceReposistory.get(id);
    const environments = [];
    for (let i = 0; i < workspace.environments?.length; i++) {
      const environment = await this.environmentRepository.get(
        workspace.environments[i].id.toString(),
      );
      environments.push(environment);
    }
    return environments;
  }

  /**
   * Updates an existing environment.
   * @param environmentId - Environment id you want to update.
   * @param updateEnvironmentDto - Updated environment object.
   * @param workspaceId - Workspace id you want to update into it.
   */
  async updateEnvironment(
    environmentId: string,
    updateEnvironmentDto: UpdateEnvironmentDto,
    workspaceId: string,
  ): Promise<UpdateResult> {
    await this.isWorkspaceAdminorEditor(workspaceId);
    const data = await this.environmentRepository.update(
      environmentId,
      updateEnvironmentDto,
    );
    return data;
  }

  /**
   * Fetches individual environment.
   * @param workspaceId - Workspace id to which environment belongs to.
   * @param environmentId - Environment id to get that environment object.
   */
  async getIndividualEnvironment(
    workspaceId: string,
    environmentId: string,
  ): Promise<WithId<Environment>> {
    const user = this.contextService.get("user");
    await this.checkPermission(workspaceId, user._id);
    const environment = await this.getEnvironment(environmentId);
    return environment;
  }

  /**
   * Checks if user is admin or editor of workspace.
   * @param id - Workspace id.
   */
  async isWorkspaceAdminorEditor(id: string): Promise<Workspace> {
    const workspaceData = await this.workspaceReposistory.get(id);
    const userId = this.contextService.get("user")._id;
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
