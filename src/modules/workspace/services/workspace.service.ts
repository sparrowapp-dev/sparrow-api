import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  workspaceUsersResponseDto,
} from "../payloads/workspace.payload";
import {
  Workspace,
  WorkspaceDto,
  WorkspaceType,
  WorkspaceWithNewInviteTag,
} from "@src/modules/common/models/workspace.model";
import {
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";
import { TeamRole, WorkspaceRole } from "@src/modules/common/enum/roles.enum";
import { TeamRepository } from "@src/modules/identity/repositories/team.repository";
import { CollectionDto } from "@src/modules/common/models/collection.model";

import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import {
  DefaultEnvironment,
  EnvironmentDto,
  EnvironmentType,
} from "@src/modules/common/models/environment.model";
import { CreateEnvironmentDto } from "../payloads/environment.payload";
import { EnvironmentService } from "./environment.service";
import { TeamService } from "@src/modules/identity/services/team.service";
import { TeamUserService } from "@src/modules/identity/services/team-user.service";
import {
  AddUserInWorkspaceDto,
  AddUsersWithRolesInWorkspaceDto,
  UserRoleInWorkspcaeDto,
  UsersWithRolesDto,
  WorkspaceInviteMailDto,
  WorkspaceInviteMailWIthRoleDto,
  removeUserFromWorkspaceDto,
} from "../payloads/workspaceUser.payload";
import { User } from "@src/modules/common/models/user.model";
import { isString } from "class-validator";
import { ConfigService } from "@nestjs/config";
import { Team } from "@src/modules/common/models/team.model";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { ProducerService } from "@src/modules/common/services/event-producer.service";
import { UpdatesType } from "@src/modules/common/enum/updates.enum";
import { EmailService } from "@src/modules/common/services/email.service";
import { TestflowInfoDto } from "@src/modules/common/models/testflow.model";
import { DecodedUserObject } from "@src/types/fastify";
import { isValidName } from "@src/modules/common/util/validate.name.util";

/**
 * Workspace Service
 */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly teamRepository: TeamRepository,
    private readonly environmentService: EnvironmentService,
    private readonly userRepository: UserRepository,
    private readonly teamUserService: TeamUserService,
    private readonly teamService: TeamService,
    private readonly configService: ConfigService,
    private readonly producerService: ProducerService,
    private readonly emailService: EmailService,
  ) {}

  async get(id: string): Promise<WithId<Workspace>> {
    const data = await this.workspaceRepository.get(id);
    return data;
  }

  async getPublicWorkspace(id: string): Promise<WithId<Workspace>> {
    const data = await this.workspaceRepository.getPublicWorkspace(id);
    if (!data) {
      throw new BadRequestException("Workspace Not Found.");
    } else if (data.workspaceType !== WorkspaceType.PUBLIC) {
      throw new BadRequestException("Workspace is Not Public.");
    }
    return data;
  }

  async getAllWorkSpaces(
    userId: string,
    currentUser: DecodedUserObject,
  ): Promise<Workspace[]> {
    if (currentUser?._id.toString() !== userId.toString()) {
      throw new BadRequestException(
        "You are not authorised to fetch the workspace details of this particular user",
      );
    }
    const user = await this.userRepository.getUserById(userId, currentUser);
    if (!user) {
      throw new BadRequestException(
        "The user with this id does not exist in the system",
      );
    }

    const userWorkspaceEntries = user.workspaces || [];
    const workspaceIdMap = new Map<string, boolean>();

    const workspaceIds = userWorkspaceEntries.map((w) => {
      const idStr = w.workspaceId.toString();
      workspaceIdMap.set(idStr, w.isNewInvite ?? false);
      return idStr;
    });

    let workspaces: WithId<WorkspaceWithNewInviteTag>[] = [];

    if (workspaceIds.length > 0) {
      // Bulk fetch all workspaces in one DB call
      const workspaceDocs =
        await this.workspaceRepository.getWorkspacesByIds(workspaceIds);

      workspaces = workspaceDocs.map((doc) => {
        const isNewInvite = workspaceIdMap.get(doc._id.toString()) ?? false;
        return {
          ...doc,
          isNewInvite,
        };
      });
    }

    if (!workspaces.length) {
      const teams = await this.teamService.getAllTeams(userId, currentUser);
      for (const team of teams) {
        if (team.owner === userId) {
          const workspace = await this.create(
            {
              id: team._id.toString(),
              name: "My Workspace",
            },
            user,
          );
          if (workspace) {
            const workspaceData: WithId<WorkspaceWithNewInviteTag> =
              await this.get(workspace.insertedId.toString());
            workspaces.push(workspaceData);
          }
          break;
        }
      }
    }
    return workspaces;
  }
  async getAllTeamWorkSpaces(teamId: string): Promise<Workspace[]> {
    const team = await this.teamRepository.get(teamId);
    const workspaceIds = team.workspaces?.map((w) => w.id.toString()) || [];
    if (workspaceIds.length === 0) return [];
    const workspaces =
      await this.workspaceRepository.getWorkspacesByIds(workspaceIds);
    return workspaces;
  }

  async IsWorkspaceAdminOrEditor(
    id: string,
    userId: ObjectId,
  ): Promise<Workspace> {
    const workspaceData = await this.get(id);
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

  async isTeamMember(
    teamId: string,
    userEmail: string,
  ): Promise<boolean | string> {
    const teamData = await this.teamRepository.findTeamByTeamId(
      new ObjectId(teamId),
    );
    for (const user of teamData.users) {
      if (user.email === userEmail) return user.id;
    }
    return false;
  }

  async isWorkspaceAdmin(
    workspaceId: string,
    userId: string,
    currentUserId: ObjectId,
  ): Promise<boolean> {
    const workspaceData = await this.workspaceRepository.get(workspaceId);
    for (const admin of workspaceData.admins) {
      if (admin.id === userId) {
        throw new BadRequestException(
          "You cannot add, remove or update a Admin",
        );
      }
    }
    for (const admin of workspaceData.admins) {
      if (admin.id === currentUserId.toString()) {
        return true;
      }
    }
    throw new BadRequestException("You don't have access of this Workspace");
  }

  async isWorkspaceMember(
    workspaceId: string,
    userId: string | boolean,
  ): Promise<boolean> {
    const workspaceData = await this.workspaceRepository.get(workspaceId);
    for (const user of workspaceData.users) {
      if (user.id === userId) {
        return true;
      }
    }
    return false;
  }

  async isLastTeamWorkspace(
    workspaceId: string,
    userId: string,
    currentUser: DecodedUserObject,
  ): Promise<boolean> {
    const userData = await this.userRepository.getUserById(userId, currentUser);
    const workspaceData = await this.workspaceRepository.get(workspaceId);
    let count = 0;
    for (const workspace of userData.workspaces) {
      if (workspace.teamId === workspaceData.team.id) {
        count++;
      }
    }
    if (count > 1) return false;
    return true;
  }

  async roleCheck(role: string): Promise<boolean> {
    if (role === WorkspaceRole.ADMIN) {
      throw new BadRequestException("You cannot add or switch as Admin's role");
    }
    return true;
  }

  async checkAdminRole(workspaceId: string, userId: ObjectId) {
    const workspace = await this.workspaceRepository.get(workspaceId);
    for (const item of workspace.admins) {
      if (item.id === userId.toString()) {
        return true;
      }
    }
    throw new BadRequestException("You don't have access of this Workspace");
  }

  /**
   * Creates a new workspace in the database
   * @param {CreateOrUpdateWorkspaceDto} workspaceData
   * @returns {Promise<InsertOneWriteOpResult<Workspace>>} result of the insert operation
   */
  async create(
    workspaceData: CreateWorkspaceDto,
    user: DecodedUserObject,
  ): Promise<InsertOneResult<Document>> {
    if (!isValidName(workspaceData.name)) {
      throw new BadRequestException(
        "Workspace name must be 1-100 characters, contain at least one letter or number, and only use spaces, dashes, underscores, dots, or @.",
      );
    }
    const teamId = new ObjectId(workspaceData.id);
    let teamData: WithId<Team>;
    if (workspaceData?.firstWorkspace) {
      teamData = await this.teamRepository.findTeamByTeamId(teamId);
    } else {
      teamData = await this.teamService.isTeamOwnerOrAdmin(teamId, user._id);
    }
    const planData = teamData?.plan;
    const uuid = new ObjectId();
    const ws = {
      id: uuid,
      name: workspaceData.name,
    };
    const res = await this.teamRepository.updateTeamWorkspaceCountById(
      teamId,
      planData,
      ws,
    );
    if (!res) {
      throw new ForbiddenException("Plan limit reached");
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
      user,
    );
    const environment = await this.environmentService.getEnvironment(
      envData.insertedId.toString(),
    );
    const { _id: id, name, type } = environment;
    const environmentDto: EnvironmentDto = { id, name, type };

    const adminInfo = [];
    const usersInfo = [];
    for (const user of teamData.users) {
      if (user.role !== TeamRole.MEMBER) {
        adminInfo.push({
          id: user.id.toString(),
          name: user.name,
        });
        usersInfo.push({
          role: WorkspaceRole.ADMIN,
          id: user.id.toString(),
          name: user.name,
          email: user.email,
        });
      }
    }
    const params = {
      name: workspaceData.name,
      description: workspaceData.description || "",
      team: {
        id: teamData._id.toString(),
        name: teamData.name,
        hubUrl: teamData?.hubUrl || "",
      },
      workspaceType: WorkspaceType.PRIVATE,
      users: usersInfo,
      admins: adminInfo,
      environments: [
        {
          id: environmentDto.id,
          name: environmentDto.name,
          type: environmentDto.type,
        },
      ],
      createdAt: new Date(),
      createdBy: user._id.toString(),
      updatedAt: new Date(),
      updatedBy: user._id.toString(),
    };
    const response = await this.workspaceRepository.addWorkspace(params, uuid);
    const userIdArray = [];
    for (const item of teamData.users) {
      if (item.role !== TeamRole.MEMBER) {
        if (!isString(item.id)) {
          userIdArray.push(item.id);
          continue;
        }
        userIdArray.push(new ObjectId(item.id));
      }
    }
    const userDataArray =
      await this.userRepository.findUsersByIdArray(userIdArray);
    for (let index = 0; index < userDataArray.length; index++) {
      userDataArray[index].workspaces.push({
        workspaceId: response.insertedId.toString(),
        name: workspaceData.name,
        teamId: workspaceData.id,
        isNewInvite: false,
      });
    }
    const userDataPromises = [];
    for (const item of userDataArray) {
      userDataPromises.push(
        this.userRepository.updateUserById(new ObjectId(item._id), item),
      );
    }
    await Promise.all(userDataPromises);
    const updateMessage = `New workspace "${workspaceData.name}" is created under "${teamData.name}" hub`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        type: UpdatesType.WORKSPACE,
        workspaceId: response.insertedId,
        user,
      }),
    });

    const userDetails = await this.userRepository.getUserById(
      teamData.owner,
      user,
    );

    if (!workspaceData?.firstWorkspace) {
      this.newWorkspaceEmail(
        userDetails.name.split(" ")[0],
        workspaceData.name,
        teamData.name,
        userDetails.email,
      );
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
    updates: Partial<UpdateWorkspaceDto>,
    user: DecodedUserObject,
  ): Promise<UpdateResult<Document>> {
    if (updates.name !== undefined && !isValidName(updates.name)) {
      throw new BadRequestException(
        "Workspace name must be 1-100 characters, contain at least one letter or number, and only use spaces, dashes, underscores, dots, or @.",
      );
    }
    const workspace = await this.IsWorkspaceAdminOrEditor(id, user._id);
    const updateNameMessage = `Workspace is renamed from "${workspace.name}" to "${updates.name}"`;
    const data = await this.workspaceRepository.update(id, updates, user._id);
    const team = await this.teamRepository.findTeamByTeamId(
      new ObjectId(workspace.team.id),
    );
    if (updates.name) {
      const teamWorkspaces = [...team.workspaces];
      for (let index = 0; index < teamWorkspaces.length; index++) {
        if (teamWorkspaces[index].id.toString() === id) {
          teamWorkspaces[index].name = updates.name;
        }
      }
      const updatedTeamParams = {
        workspaces: teamWorkspaces,
      };
      await this.teamRepository.updateTeamById(
        new ObjectId(workspace.team.id),
        updatedTeamParams,
      );
      const workspaceUsers = [...workspace.users];
      const updatedIdArray = [];
      for (const item of workspaceUsers) {
        if (!isString(item.id)) {
          updatedIdArray.push(item.id);
          continue;
        }
        updatedIdArray.push(new ObjectId(item.id));
      }
      const userDataArray =
        await this.userRepository.findUsersByIdArray(updatedIdArray);
      for (let index = 0; index < userDataArray.length; index++) {
        for (
          let flag = 0;
          flag < userDataArray[index].workspaces.length;
          flag++
        ) {
          if (
            userDataArray[index].workspaces[flag].workspaceId.toString() === id
          ) {
            userDataArray[index].workspaces[flag].name = updates.name;
          }
        }
      }
      const userDataPromises = [];
      for (const item of userDataArray) {
        userDataPromises.push(
          this.userRepository.updateUserById(new ObjectId(item._id), item),
        );
      }
      await Promise.all(userDataPromises);
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateNameMessage,
          type: UpdatesType.WORKSPACE,
          workspaceId: id,
          user,
        }),
      });
    }
    if (updates?.description) {
      const updateDescriptionMessage = `"${workspace.name}" workspace description is updated `;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateDescriptionMessage,
          type: UpdatesType.WORKSPACE,
          workspaceId: id,
          user,
        }),
      });
    }
    return data;
  }

  /**
   * Deletes a workspace from the database by UUID
   * @param {string} id
   * @returns {Promise<DeleteWriteOpResultObject>} result of the delete operation
   */
  async delete(id: string, userId: ObjectId): Promise<DeleteResult> {
    await this.checkAdminRole(id, userId);
    const workspace = await this.workspaceRepository.get(id);
    const teamData = await this.teamRepository.findTeamByTeamId(
      new ObjectId(workspace.team.id),
    );
    const teamWorkspaces = [...teamData.workspaces];
    const updatedTeamWorkspaces = teamWorkspaces.filter(
      (workspace) => workspace.id.toString() !== id,
    );
    const updatedTeamParams = {
      workspaces: updatedTeamWorkspaces,
    };
    await this.teamRepository.updateTeamById(
      new ObjectId(workspace.team.id),
      updatedTeamParams,
    );
    const workspaceUsers = [...workspace.users];
    const updatedIdArray = [];
    for (const item of workspaceUsers) {
      if (!isString(item.id)) {
        updatedIdArray.push(item.id);
        continue;
      }
      updatedIdArray.push(new ObjectId(item.id));
    }
    const userDataArray =
      await this.userRepository.findUsersByIdArray(updatedIdArray);
    for (let index = 0; index < userDataArray.length; index++) {
      userDataArray[index].workspaces = userDataArray[index].workspaces.filter(
        (item: any) => item.workspaceId.toString() !== id,
      );
    }
    const userDataPromises = [];
    for (const item of userDataArray) {
      userDataPromises.push(
        this.userRepository.updateUserById(new ObjectId(item._id), item),
      );
    }
    await Promise.all(userDataPromises);
    const data = await this.workspaceRepository.delete(id);
    return data;
  }

  async addCollectionInWorkSpace(
    workspaceId: string,
    collection: CollectionDto,
    userId: ObjectId,
  ): Promise<void> {
    await this.IsWorkspaceAdminOrEditor(workspaceId, userId);
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
    userId: ObjectId,
  ): Promise<void> {
    await this.IsWorkspaceAdminOrEditor(workspaceId, userId);
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
    userId: ObjectId,
  ): Promise<void> {
    await this.IsWorkspaceAdminOrEditor(workspaceId, userId);
    const data = await this.get(workspaceId);

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
    userId: ObjectId,
  ): Promise<void> {
    await this.IsWorkspaceAdminOrEditor(workspaceId, userId);
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
    userId: ObjectId,
  ): Promise<void> {
    await this.IsWorkspaceAdminOrEditor(workspaceId, userId);
    const data = await this.get(workspaceId);

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
    userId: ObjectId,
  ): Promise<void> {
    await this.IsWorkspaceAdminOrEditor(workspaceId, userId);
    await this.workspaceRepository.updateEnvironmentinWorkspace(
      workspaceId,
      environmentId,
      name,
    );
    return;
  }

  async inviteUserInWorkspaceEmail(
    payload: WorkspaceInviteMailDto,
    userRole: string,
    currentUsername: string,
  ) {
    const transporter = this.emailService.createTransporter();

    const promiseArray = [];
    for (const user of payload.users) {
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: user.email,
        text: "User Invited",
        template: "inviteWorkspaceEmail",
        context: {
          firstname: user?.name?.split(" ")[0],
          username: currentUsername?.split(" ")[0],
          userRole: userRole.charAt(0).toUpperCase() + userRole.slice(1),
          workspacename: payload.workspaceName,
          sparrowEmail: this.configService.get("support.sparrowEmail"),
          sparrowWebsite: this.configService.get("support.sparrowWebsite"),
          sparrowWebsiteName: this.configService.get(
            "support.sparrowWebsiteName",
          ),
        },
        subject: `You've been invited to contribute to ${payload.workspaceName} workspace on Sparrow!`,
      };
      promiseArray.push(this.emailService.sendEmail(transporter, mailOptions));
    }
    await Promise.all(promiseArray);
  }

  async addUserInWorkspace(
    payload: AddUserInWorkspaceDto,
    user: DecodedUserObject,
  ): Promise<object> {
    let workspaceData = await this.workspaceRepository.get(payload.workspaceId);
    await this.checkAdminRole(payload.workspaceId, user._id);
    await this.roleCheck(payload.role);
    const usersExist = [];
    const usersNotExist = [];
    const alreadyWorkspaceMember = [];
    for (const emailId of payload.users) {
      const teamMember = await this.isTeamMember(
        workspaceData.team.id,
        emailId.toLowerCase(),
      );
      if (teamMember) {
        const workspaceMember = await this.isWorkspaceMember(
          payload.workspaceId,
          teamMember,
        );
        if (workspaceMember) {
          alreadyWorkspaceMember.push(emailId.toLowerCase());
        } else {
          usersExist.push(emailId.toLowerCase());
        }
      } else {
        usersNotExist.push(emailId.toLowerCase());
      }
    }
    for (const emailId of usersExist) {
      workspaceData = await this.workspaceRepository.get(payload.workspaceId);
      const userData = await this.userRepository.getUserByEmail(emailId);
      const userWorkspaces = [...userData.workspaces];
      userWorkspaces.push({
        workspaceId: workspaceData._id.toString(),
        teamId: workspaceData.team.id,
        name: workspaceData.name,
        isNewInvite: true,
      });
      const updatedUserParams = {
        workspaces: userWorkspaces,
      };
      await this.userRepository.updateUserById(userData._id, updatedUserParams);
      const workspaceUsers = [...workspaceData.users];
      workspaceUsers.push({
        role: payload.role,
        id: userData._id.toString(),
        name: userData.name,
        email: userData.email,
      });
      const updatedWorkspaceParams = {
        users: workspaceUsers,
      };
      await this.workspaceRepository.updateWorkspaceById(
        new ObjectId(payload.workspaceId),
        updatedWorkspaceParams,
      );
      const updateMessage = `"${userData?.name}" is added to "${workspaceData?.name}" workspace`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.WORKSPACE,
          workspaceId: payload.workspaceId,
          user,
        }),
      });
    }
    const userExistData = [];
    for (const email of usersExist) {
      const userData = await this.userRepository.getUserByEmail(
        email.toLowerCase(),
      );
      userExistData.push(userData);
    }

    await this.inviteUserInWorkspaceEmail(
      {
        users: userExistData,
        workspaceName: workspaceData.name,
      },
      payload.role,
      user.name,
    );

    await this.teamUserService.sendInvite(
      {
        teamId: workspaceData.team.id,
        users: usersNotExist,
        role: payload.role,
        workspaces: [
          {
            id: workspaceData._id.toString(),
            name: workspaceData.name,
          },
        ],
      },
      user,
    );

    const response = {
      notExistInTeam: usersNotExist,
      existInWorkspace: alreadyWorkspaceMember,
    };
    return response;
  }

  async removeUserFromWorkspace(
    payload: removeUserFromWorkspaceDto,
    currentUser: DecodedUserObject,
  ): Promise<WithId<User>> {
    await this.isWorkspaceAdmin(
      payload.workspaceId,
      payload.userId,
      currentUser._id,
    );

    const workspaceData = await this.workspaceRepository.get(
      payload.workspaceId,
    );
    const workspaceUsers = [...workspaceData.users];
    const updatedWorkspaceUsers = workspaceUsers.filter(
      (user) => user.id !== payload.userId,
    );
    const updatedWorkspaceParams = {
      users: updatedWorkspaceUsers,
    };
    await this.workspaceRepository.updateWorkspaceById(
      new ObjectId(payload.workspaceId),
      updatedWorkspaceParams,
    );
    const userData = await this.userRepository.findUserByUserId(
      new ObjectId(payload.userId),
    );
    const userWorkspaces = [...userData.workspaces];
    const updatedUserWorkspaces = userWorkspaces.filter(
      (workspace) => workspace.workspaceId !== payload.workspaceId,
    );
    const updatedUserParams = {
      workspaces: updatedUserWorkspaces,
    };
    const response = await this.userRepository.updateUserById(
      new ObjectId(payload.userId),
      updatedUserParams,
    );
    const updateMessage = `"${userData?.name}" is no longer part of "${workspaceData?.name}" workspace`;
    await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
      value: JSON.stringify({
        message: updateMessage,
        type: UpdatesType.WORKSPACE,
        workspaceId: payload.workspaceId,
        user: currentUser,
      }),
    });

    return response;
  }

  async changeUserRole(
    payload: UserRoleInWorkspcaeDto,
    currentUser: DecodedUserObject,
  ) {
    let getUserIndex;
    await this.isWorkspaceAdmin(
      payload.workspaceId,
      payload.userId,
      currentUser._id,
    );
    await this.roleCheck(payload.role);
    const workspaceData = await this.workspaceRepository.get(
      payload.workspaceId,
    );
    const workspaceUsers = [...workspaceData.users];
    for (let index = 0; index < workspaceUsers.length; index++) {
      if (workspaceUsers[index].id === payload.userId) {
        getUserIndex = index;
        const updateMessage = `"${workspaceUsers[index].name}'s" role is changed from "${workspaceUsers[index].role}" to "${payload.role}" in "${workspaceData.name}" workspace`;
        await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
          value: JSON.stringify({
            message: updateMessage,
            type: UpdatesType.WORKSPACE,
            workspaceId: payload.workspaceId,
            user: currentUser,
          }),
        });
        workspaceUsers[index].role = payload.role;
      }
    }
    const updatedWorkspaceParams = {
      users: workspaceUsers,
    };
    const response = await this.workspaceRepository.updateWorkspaceById(
      new ObjectId(payload.workspaceId),
      updatedWorkspaceParams,
    );

    if (payload.role == WorkspaceRole.VIEWER) {
      await this.demoteEditorEmail(
        workspaceUsers[getUserIndex].name,
        workspaceUsers[getUserIndex].role,
        workspaceData.name,
        workspaceUsers[getUserIndex].email,
      );
    } else {
      await this.promoteViewerEmail(
        workspaceUsers[getUserIndex].name,
        workspaceUsers[getUserIndex].role,
        workspaceData.name,
        workspaceUsers[getUserIndex].email,
      );
    }
    return response;
  }

  async getAllWorkspaceUsers(
    workspaceId: string,
    currentUser: DecodedUserObject,
  ): Promise<workspaceUsersResponseDto[]> {
    const workspaceData = await this.workspaceRepository.get(workspaceId);
    const workspaceUsers = [...workspaceData.users];

    if (
      !workspaceUsers.some(
        (u: any) => u.id.toString() === currentUser._id.toString(),
      )
    ) {
      throw new ForbiddenException("You are not authorized to access this API");
    }
    const updatedIdArray = [];
    for (const item of workspaceUsers) {
      if (!isString(item.id)) {
        updatedIdArray.push(item.id);
        continue;
      }
      updatedIdArray.push(new ObjectId(item.id));
    }
    const userDataArray =
      await this.userRepository.findUsersByIdArray(updatedIdArray);
    const allUsers: workspaceUsersResponseDto[] = [];
    for (const user of userDataArray) {
      for (let index = 0; index < workspaceData.users.length; index++) {
        if (user._id.toString() === workspaceData.users[index].id.toString()) {
          allUsers.push({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: workspaceData.users[index].role,
            workspaceId: workspaceData._id.toString(),
          });
        }
      }
    }
    return allUsers;
  }

  /**
   * Disable workspace new invite tag
   */
  async disableWorkspaceNewInvite(
    userId: string,
    workspaceId: string,
    currentUser: DecodedUserObject,
  ): Promise<Workspace> {
    const user = await this.userRepository.getUserById(userId, currentUser);
    const workspaces = user.workspaces.map((workspace) => {
      if (workspace.workspaceId.toString() === workspaceId) {
        workspace.isNewInvite = false;
      }
      return workspace;
    });
    await this.userRepository.updateUserById(new ObjectId(userId), {
      workspaces,
    });
    const workspaceDetails = await this.workspaceRepository.get(workspaceId);
    return workspaceDetails;
  }

  /*
   * Sends an email notification to a user when a new workspace is created under a team.
   *
   * @param {string} ownerName - The name of the owner of the new workspace.
   * @param {string} workspaceName - The name of the newly created workspace.
   * @param {string} teamName - The name of the team under which the workspace was created.
   * @param {string} email - The email address of the recipient.
   * @returns {Promise<void>} A promise that resolves when the email has been sent.
   *
   * @throws {Error} Throws an error if there is an issue with sending the email.
   */
  async newWorkspaceEmail(
    ownerName: string,
    workspaceName: string,
    teamName: string,
    email: string,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: email,
      text: "Workspace Notification",
      template: "newWorkspaceEmail",
      context: {
        ownerName: ownerName,
        workspaceName: workspaceName,
        teamName: teamName,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Workspace Update: New Workspace is created under ${teamName} hub.`,
    };

    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }

  /**
   * Sends an email notification to a user when their role is demoted within a workspace.
   *
   * @param {string} userName - The name of the user whose role is being demoted.
   * @param {string} userRole - The current role of the user being demoted.
   * @param {string} workspaceName - The name of the workspace where the role change is occurring.
   * @param {string} email - The email address of the recipient.
   * @returns {Promise<void>} A promise that resolves when the email has been sent.
   *
   * @throws {Error} Throws an error if there is an issue with sending the email.
   */
  async demoteEditorEmail(
    userName: string,
    userRole: string,
    workspaceName: string,
    email: string,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();
    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: email,
      text: "Workspace Notification",
      template: "demoteEditorEmail",
      context: {
        userName: userName.split(" ")[0],
        userRole: userRole.charAt(0).toUpperCase() + userRole.slice(1),
        workspaceName: workspaceName,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Your Role in the ${workspaceName} Workspace has been updated`,
    };

    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }

  /**
   * Sends an email notification to a user when their role is promoted within a workspace.
   *
   * @param {string} userName - The name of the user whose role is being promoted.
   * @param {string} userRole - The new role of the user being promoted.
   * @param {string} workspaceName - The name of the workspace where the role change is occurring.
   * @param {string} email - The email address of the recipient.
   * @returns {Promise<void>} A promise that resolves when the email has been sent.
   *
   * @throws {Error} Throws an error if there is an issue with sending the email.
   */
  async promoteViewerEmail(
    userName: string,
    userRole: string,
    workspaceName: string,
    email: string,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: email,
      text: "Workspace Notification",
      template: "promoteViewerEmail",
      context: {
        userName: userName,
        userRole: userRole,
        workspaceName: workspaceName,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Your Role in the ${workspaceName} Workspace has been updated`,
    };

    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }

  /**
   * Updates the team name for all workspaces associated with a given team ID.
   * Finds the workspaces by their IDs, updates the team name if the workspace contains the target team,
   * and then saves the updated workspaces to the database.
   *
   * @param teamId - The ID of the team whose name is being updated.
   * @param teamName - The new name of the team.
   * @param workspaceArray - An array of workspace DTOs, containing the workspaces to be updated.
   * @returns Resolves when all workspaces have been updated in the database.
   */
  async updateTeamDetailsInWorkspace(
    teamId: string,
    teamName: string,
    workspaceArray: WorkspaceDto[],
  ) {
    const updatedIdArray = [];
    // Iterate over each workspace in the array to validate or convert workspace IDs
    for (const item of workspaceArray) {
      if (!isString(item.id)) {
        updatedIdArray.push(item.id);
        continue;
      }
      updatedIdArray.push(new ObjectId(item.id));
    }
    const workspaceDataArray =
      await this.workspaceRepository.findWorkspacesByIdArray(updatedIdArray);
    for (let index = 0; index < workspaceDataArray.length; index++) {
      if (workspaceDataArray[index].team.id === teamId) {
        workspaceDataArray[index].team.name = teamName;
      }
    }
    const workspaceDataPromises = [];
    for (const item of workspaceDataArray) {
      workspaceDataPromises.push(
        this.workspaceRepository.updateWorkspaceById(
          new ObjectId(item._id),
          item,
        ),
      );
    }
    await Promise.all(workspaceDataPromises);
  }

  /**
   * Adds a new testflow to a workspace
   * @param workspaceId - Id of workspace you want to insert into it.
   * @param testflow - new testflow object to be inserted in workspace
   */
  async addTestflowInWorkSpace(
    workspaceId: string,
    testflow: TestflowInfoDto,
    userId: ObjectId,
  ): Promise<UpdateResult<Document>> {
    await this.IsWorkspaceAdminOrEditor(workspaceId, userId);
    const response = await this.workspaceRepository.addTestflowInWorkspace(
      workspaceId,
      testflow,
    );
    return response;
  }

  /**
   * deletes an existing testflow from a workspace
   * @param workspaceId - Id of workspace you want to delete from it.
   * @param testflowId - Id of testflow you want to delete.
   */
  async deleteTestflowInWorkSpace(
    workspaceId: string,
    testflowId: string,
    userId: ObjectId,
  ): Promise<UpdateResult<Document>> {
    await this.IsWorkspaceAdminOrEditor(workspaceId, userId);
    const data = await this.get(workspaceId);

    const filteredTestflows = data.testflows.filter((flow) => {
      return flow.id.toString() !== testflowId;
    });
    const response = await this.workspaceRepository.deleteTestflowInWorkspace(
      workspaceId,
      filteredTestflows,
    );
    return response;
  }

  /**
   * updates an existing testflow from a workspace
   * @param workspaceId - Id of workspace you want to update into it.
   * @param testflowId - Id of testflow you want to update.
   * @param name - updated name of the testflow .
   */
  async updateTestflowInWorkSpace(
    workspaceId: string,
    testflowId: string,
    name: string,
    userId: ObjectId,
  ): Promise<UpdateResult<Document>> {
    await this.IsWorkspaceAdminOrEditor(workspaceId, userId);
    const response = await this.workspaceRepository.updateTestflowInWorkspace(
      workspaceId,
      testflowId,
      name,
    );
    return response;
  }

  /**
   * Send the invitation to users with roles in a workspace.
   *
   * @param payload - The payload containing users and workspace information.
   */
  async inviteUsersWithRolesInWorkspaceEmail(
    payload: WorkspaceInviteMailWIthRoleDto,
    currentUserName: string,
  ) {
    // Create an email transporter instance
    const transporter = this.emailService.createTransporter();
    const promiseArray = [];
    // Loop through each user to send an invite email
    for (const user of payload.users) {
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: user.email,
        text: "User Invited",
        template: "inviteWorkspaceEmail",
        context: {
          firstname: user.name.split(" ")[0],
          username: currentUserName.split(" ")[0],
          userRole: user.role.charAt(0).toUpperCase() + user.role.slice(1),
          workspacename: payload.workspaceName,
          sparrowEmail: this.configService.get("support.sparrowEmail"),
          sparrowWebsite: this.configService.get("support.sparrowWebsite"),
          sparrowWebsiteName: this.configService.get(
            "support.sparrowWebsiteName",
          ),
        },
        subject: `You've been invited to contribute to ${payload.workspaceName} workspace on Sparrow!`,
      };
      promiseArray.push(this.emailService.sendEmail(transporter, mailOptions));
    }
    await Promise.all(promiseArray);
  }

  /**
   * Validates if the provided roles are valid, throwing an error if any user has the admin role.
   *
   * @param users - Array of users with roles.
   * @returns Returns true if all roles are valid.
   */
  async isRolesValid(users: UsersWithRolesDto[]): Promise<boolean> {
    for (const user of users) {
      if (user.role === WorkspaceRole.ADMIN) {
        throw new BadRequestException(
          "You cannot add or switch as Admin's role",
        );
      }
    }

    return true;
  }

  /**
   * Adds multiple users with roles to a workspace, updates the repository, and sends invites.
   *
   * @param payload - Payload containing users and their roles.
   * @param workspaceId - The ID of the workspace to which users are being added.
   * @returns Returns an object with the results of the operation.
   */
  async addUsersWithRolesInWorkspace(
    payload: AddUsersWithRolesInWorkspaceDto,
    workspaceId: string,
    user: DecodedUserObject,
  ): Promise<object> {
    let workspaceData = await this.workspaceRepository.get(workspaceId);
    await this.checkAdminRole(workspaceId, user._id);
    await this.isRolesValid(payload.users);
    const usersExist: UsersWithRolesDto[] = [];
    const usersNotExist = [];
    const alreadyWorkspaceMember = [];
    for (const users of payload.users) {
      const teamMember = await this.isTeamMember(
        workspaceData.team.id,
        users.user.toLowerCase(),
      );
      if (teamMember) {
        const workspaceMember = await this.isWorkspaceMember(
          workspaceId,
          teamMember,
        );
        if (workspaceMember) {
          alreadyWorkspaceMember.push(users.user.toLowerCase());
        } else {
          usersExist.push(users);
        }
      } else {
        usersNotExist.push(users.user.toLowerCase());
      }
    }
    for (const users of usersExist) {
      workspaceData = await this.workspaceRepository.get(workspaceId);
      const userData = await this.userRepository.getUserByEmail(
        users.user.toLowerCase(),
      );
      const userWorkspaces = [...userData.workspaces];
      userWorkspaces.push({
        workspaceId: workspaceData._id.toString(),
        teamId: workspaceData.team.id,
        name: workspaceData.name,
        isNewInvite: true,
      });
      const updatedUserParams = {
        workspaces: userWorkspaces,
      };
      await this.userRepository.updateUserById(userData._id, updatedUserParams);
      const workspaceUsers = [...workspaceData.users];
      workspaceUsers.push({
        role: users.role,
        id: userData._id.toString(),
        name: userData.name,
        email: userData.email,
      });
      const updatedWorkspaceParams = {
        users: workspaceUsers,
      };
      await this.workspaceRepository.updateWorkspaceById(
        new ObjectId(workspaceId),
        updatedWorkspaceParams,
      );
      const updateMessage = `"${userData?.name}" is added to "${workspaceData?.name}" workspace`;
      await this.producerService.produce(TOPIC.UPDATES_ADDED_TOPIC, {
        value: JSON.stringify({
          message: updateMessage,
          type: UpdatesType.WORKSPACE,
          workspaceId: workspaceId,
          user,
        }),
      });
    }
    const userExistData = [];
    for (const users of usersExist) {
      const userData = await this.userRepository.getUserByEmail(
        users.user.toLowerCase(),
      );
      userExistData.push({ ...userData, role: users.role });
    }

    await this.inviteUsersWithRolesInWorkspaceEmail(
      {
        users: userExistData,
        workspaceName: workspaceData.name,
      },
      user.name,
    );
    const response = {
      notExistInTeam: usersNotExist,
      existInWorkspace: alreadyWorkspaceMember,
    };
    return response;
  }

  async updateWorkspaceType(
    workspaceId: string,
    type: WorkspaceType,
    userId: ObjectId,
  ): Promise<WithId<Workspace>> {
    await this.checkAdminRole(workspaceId, userId);
    const response = await this.workspaceRepository.updateWorkspaceTypeById(
      new ObjectId(workspaceId),
      type,
    );
    return response;
  }

  /**
   * Retrieves a paginated list of public workspaces.
   * @param page - The page number (1-based).
   * @param pageSize - The number of items per page.
   * @returns A list of public workspaces and total count.
   */
  async getPaginatedPublicWorkspaces(
    page: string,
    pageSize: number,
  ): Promise<{
    workspaces: WithId<Workspace>[];
    total: number;
  }> {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    return this.workspaceRepository.getPaginatedPublicWorkspaces(
      pageNum,
      pageSize,
    );
  }

  /**
   * Searches public workspaces by name, team name, and description.
   * @param searchTerm - The search term to match against workspace names, team names, and descriptions.
   * @param page - The page number for pagination.
   * @param pageSize - The number of results per page.
   * @returns An object containing the list of workspaces and total count.
   */
  async searchPublicWorkspacesByName(
    searchTerm: string,
    page: string,
    pageSize: number,
  ): Promise<{ workspaces: WithId<Workspace>[]; total: number }> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      throw new BadRequestException("Search term cannot be empty");
    }

    const pageNumber = parseInt(page, 10);
    if (isNaN(pageNumber) || pageNumber < 1) {
      throw new BadRequestException("Invalid page number");
    }

    return this.workspaceRepository.searchPublicWorkspacesByName(
      searchTerm.trim(),
      pageNumber,
      pageSize,
    );
  }
}
