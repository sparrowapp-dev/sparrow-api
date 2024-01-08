import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
} from "../payloads/workspace.payload";
import {
  OwnerInformationDto,
  Workspace,
  WorkspaceType,
} from "@src/modules/common/models/workspace.model";
import { ContextService } from "@src/modules/common/services/context.service";
import {
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";
import { Role } from "@src/modules/common/enum/roles.enum";
import { TeamRepository } from "@src/modules/identity/repositories/team.repository";
import { PermissionService } from "@src/modules/workspace/services/permission.service";
import { Team } from "@src/modules/common/models/team.model";
import { PermissionForUserDto } from "../payloads/permission.payload";
import { CollectionDto } from "@src/modules/common/models/collection.model";

import { Logger } from "nestjs-pino";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import {
  DefaultEnvironment,
  EnvironmentDto,
  EnvironmentType,
} from "@src/modules/common/models/environment.model";
import { CreateEnvironmentDto } from "../payloads/environment.payload";
import { EnvironmentService } from "./environment.service";
/**
 * Workspace Service
 */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly contextService: ContextService,
    private readonly teamRepository: TeamRepository,
    private readonly permissionService: PermissionService,
    private readonly environmentService: EnvironmentService,
    private readonly userRepository: UserRepository,
    private readonly logger: Logger,
  ) {}

  async get(id: string): Promise<WithId<Workspace>> {
    const data = await this.workspaceRepository.get(id);
    return data;
  }
  async getAllWorkSpaces(userId: string): Promise<Workspace[]> {
    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw new BadRequestException(
        "The user with this id does not exist in the system",
      );
    }
    const workspaces: Workspace[] = [];
    for (const { workspaceId } of user.personalWorkspaces) {
      const workspace = await this.get(workspaceId);
      workspaces.push(workspace);
    }
    return workspaces;
  }
  async getAllTeamWorkSpaces(teamId: string): Promise<Workspace[]> {
    const team = await this.teamRepository.get(teamId);
    const workspaces: Workspace[] = [];
    for (const { id } of team.workspaces) {
      const workspace = await this.get(id.toString());
      workspaces.push(workspace);
    }
    return workspaces;
  }

  async checkPermissions(teamData: Team): Promise<Array<PermissionForUserDto>> {
    const teamOwners = teamData.owners;
    const teamUsers = teamData.users;
    const permissionArray = [];
    for (const item of teamOwners) {
      for (const user of teamUsers) {
        let permissionObject;
        if (user.id.toString() === item.toString()) {
          permissionObject = {
            role: Role.ADMIN,
            id: user.id,
          };
          permissionArray.push(permissionObject);
        } else {
          permissionObject = {
            role: Role.READER,
            id: user.id,
          };
          permissionArray.push(permissionObject);
        }
      }
    }
    return permissionArray;
  }

  /**
   * Creates a new workspace in the database
   * @param {CreateOrUpdateWorkspaceDto} workspaceData
   * @returns {Promise<InsertOneWriteOpResult<Workspace>>} result of the insert operation
   */
  async create(
    workspaceData: CreateWorkspaceDto,
  ): Promise<InsertOneResult<Document>> {
    const userId = this.contextService.get("user")._id;
    const teamId = new ObjectId(workspaceData.id);
    let teamData;
    let permissionDataForTeam;
    if (workspaceData.type === WorkspaceType.TEAM) {
      teamData = await this.permissionService.isTeamOwner(teamId);
      permissionDataForTeam = await this.checkPermissions(
        teamData as unknown as Team,
      );
    }

    const createEnvironmentDto: CreateEnvironmentDto = {
      name: DefaultEnvironment.GLOBAL,
      variable: [
        {
          key: "",
          value: "",
          checked: true,
        },
      ],
    };
    const envData = await this.environmentService.createEnvironment(
      createEnvironmentDto,
      EnvironmentType.GLOBAL,
    );
    const environment = await this.environmentService.getEnvironment(
      envData.insertedId.toString(),
    );
    const { _id: id, name, type } = environment;
    const environmentDto: EnvironmentDto = { id, name, type };

    const ownerInfo: OwnerInformationDto = {
      id:
        workspaceData.type === WorkspaceType.PERSONAL
          ? userId
          : workspaceData.id,
      name:
        workspaceData.type === WorkspaceType.PERSONAL
          ? this.contextService.get("user").name
          : teamData.name,
      type: workspaceData.type as WorkspaceType,
    };
    const permissionForUser = [
      {
        role: Role.ADMIN,
        id: userId,
      },
    ];
    const params = {
      name: workspaceData.name,
      owner: ownerInfo,
      permissions:
        workspaceData.type === WorkspaceType.PERSONAL
          ? permissionForUser
          : permissionDataForTeam,
      environments: [
        {
          id: environmentDto.id,
          name: environmentDto.name,
          type: environmentDto.type,
        },
      ],
      createdAt: new Date(),
      createdBy: userId,
    };
    const response = await this.workspaceRepository.addWorkspace(params);
    if (workspaceData.type === WorkspaceType.TEAM) {
      const teamWorkspaces = [...teamData.workspaces];
      teamWorkspaces.push({
        id: response.insertedId,
        name: workspaceData.name,
      });
      const updateTeamParams = {
        workspaces: teamWorkspaces,
      };
      await this.teamRepository.updateTeamById(teamId, updateTeamParams);
    } else {
      const userData = await this.userRepository.findUserByUserId(
        new ObjectId(userId),
      );
      userData.personalWorkspaces.push({
        workspaceId: response.insertedId.toString(),
        name: ownerInfo.name,
      });
      await this.userRepository.updateUserById(new ObjectId(userId), userData);
    }
    return response;
  }

  /**
   * Updates an existing workspace in the database by UUID
   * @param {string} id
   * @param {Partial<Workspace>} updates
   * @returns {Promise<UpdateWriteOpResult>} result of the update operation
   */
  async update(
    id: string,
    updates: UpdateWorkspaceDto,
  ): Promise<UpdateResult<Document>> {
    const data = await this.workspaceRepository.update(id, updates);
    return data;
  }

  /**
   * Deletes a workspace from the database by UUID
   * @param {string} id
   * @returns {Promise<DeleteWriteOpResultObject>} result of the delete operation
   */
  async delete(id: string): Promise<DeleteResult> {
    const data = await this.workspaceRepository.delete(id);
    return data;
  }

  async addCollectionInWorkSpace(
    workspaceId: string,
    collection: CollectionDto,
  ): Promise<void> {
    const data = await this.get(workspaceId);
    if (!data) {
      throw new NotFoundException("Workspace with this id does't exist");
    }
    await this.workspaceRepository.addCollectionInWorkspace(
      workspaceId,
      collection,
    );
    return;
  }
  async updateCollectionInWorkSpace(
    workspaceId: string,
    collectionId: string,
    name: string,
  ): Promise<void> {
    const data = await this.get(workspaceId);
    if (!data) {
      throw new NotFoundException("Workspace with this id does't exist");
    }
    await this.workspaceRepository.updateCollectioninWorkspace(
      workspaceId,
      collectionId,
      name,
    );
    return;
  }

  async deleteCollectionInWorkSpace(
    workspaceId: string,
    collectionId: string,
  ): Promise<void> {
    const data = await this.get(workspaceId);
    if (!data) {
      throw new NotFoundException("Workspace with this id does't exist");
    }

    const filteredCollections = data.collection.filter((collection) => {
      return collection.id.toString() !== collectionId;
    });
    await this.workspaceRepository.deleteCollectioninWorkspace(
      workspaceId,
      filteredCollections,
    );
  }

  /**
   * Adds a new environment to a workspace
   * @param workspaceId - Id of workspace you want to insert into it.
   * @param environment - new environment object to be inserted in workspace
   */
  async addEnvironmentInWorkSpace(
    workspaceId: string,
    environment: EnvironmentDto,
  ): Promise<void> {
    const data = await this.get(workspaceId);
    if (!data) {
      throw new NotFoundException("Workspace with this id doesn't exist");
    }
    await this.workspaceRepository.addEnvironmentInWorkspace(
      workspaceId,
      environment,
    );
    return;
  }

  /**
   * deletes an existing environment from a workspace
   * @param workspaceId - Id of workspace you want to delete from it.
   * @param environmentId - Id of environment you want to delete.
   */
  async deleteEnvironmentInWorkSpace(
    workspaceId: string,
    environmentId: string,
  ): Promise<void> {
    const data = await this.get(workspaceId);
    if (!data) {
      throw new NotFoundException("Workspace with this id doesn't exist");
    }

    const filteredEnvironments = data.environments.filter((env) => {
      return env.id.toString() !== environmentId;
    });
    await this.workspaceRepository.deleteEnvironmentinWorkspace(
      workspaceId,
      filteredEnvironments,
    );
  }

  /**
   * updates an existing environment from a workspace
   * @param workspaceId - Id of workspace you want to update into it.
   * @param environmentId - Id of environment you want to update.
   * @param name - updated name of the environment .
   */
  async updateEnvironmentInWorkSpace(
    workspaceId: string,
    environmentId: string,
    name: string,
  ): Promise<void> {
    const data = await this.get(workspaceId);
    if (!data) {
      throw new NotFoundException("Workspace with this id does't exist");
    }
    await this.workspaceRepository.updateEnvironmentinWorkspace(
      workspaceId,
      environmentId,
      name,
    );
    return;
  }
}
