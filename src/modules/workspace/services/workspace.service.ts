import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  workspaceUsersResponseDto,
} from "../payloads/workspace.payload";
import { Workspace } from "@src/modules/common/models/workspace.model";
import { ContextService } from "@src/modules/common/services/context.service";
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

import { Logger } from "nestjs-pino";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import {
  DefaultEnvironment,
  EnvironmentDto,
  EnvironmentType,
} from "@src/modules/common/models/environment.model";
import { CreateEnvironmentDto } from "../payloads/environment.payload";
import { EnvironmentService } from "./environment.service";
import { TeamService } from "@src/modules/identity/services/team.service";
import {
  AddUserInWorkspaceDto,
  UserRoleInWorkspcaeDto,
  WorkspaceInviteMailDto,
  removeUserFromWorkspaceDto,
} from "../payloads/workspaceUser.payload";
import { User } from "@src/modules/common/models/user.model";
import { isString } from "class-validator";
import * as nodemailer from "nodemailer";
import hbs = require("nodemailer-express-handlebars");
import { EmailServiceProvider } from "@src/modules/common/models/user.model";
import { ConfigService } from "@nestjs/config";
import path = require("path");
/**
 * Workspace Service
 */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly contextService: ContextService,
    private readonly teamRepository: TeamRepository,
    private readonly environmentService: EnvironmentService,
    private readonly userRepository: UserRepository,
    private readonly teamService: TeamService,
    private readonly configService: ConfigService,
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
    for (const { workspaceId } of user.workspaces) {
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

  async IsWorkspaceAdminOrEditor(id: string): Promise<Workspace> {
    const workspaceData = await this.get(id);
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
  ): Promise<boolean> {
    const workspaceData = await this.workspaceRepository.get(workspaceId);
    const user = await this.contextService.get("user");
    for (const admin of workspaceData.admins) {
      if (admin.id === userId) {
        throw new BadRequestException(
          "You cannot add, remove or update a Admin",
        );
      }
    }
    for (const admin of workspaceData.admins) {
      if (admin.id === user._id.toString()) {
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
  ): Promise<boolean> {
    const userData = await this.userRepository.getUserById(userId);
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

  async checkAdminRole(workspaceId: string) {
    const user = await this.contextService.get("user");
    const workspace = await this.workspaceRepository.get(workspaceId);
    for (const item of workspace.admins) {
      if (item.id === user._id.toString()) {
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
  ): Promise<InsertOneResult<Document>> {
    const userId = this.contextService.get("user")._id;
    const teamId = new ObjectId(workspaceData.id);
    const teamData = await this.teamService.isTeamOwnerOrAdmin(teamId);
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
        });
      }
    }
    const params = {
      name: workspaceData.name,
      team: {
        id: teamData._id.toString(),
        name: teamData.name,
      },
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
      createdBy: userId,
      updatedAt: new Date(),
      updatedBy: userId,
    };
    const response = await this.workspaceRepository.addWorkspace(params);
    const teamWorkspaces = [...teamData.workspaces];
    teamWorkspaces.push({
      id: response.insertedId,
      name: workspaceData.name,
    });
    const updateTeamParams = {
      workspaces: teamWorkspaces,
    };
    await this.teamRepository.updateTeamById(teamId, updateTeamParams);
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
    const userDataArray = await this.userRepository.findUsersByIdArray(
      userIdArray,
    );
    for (let index = 0; index < userDataArray.length; index++) {
      userDataArray[index].workspaces.push({
        workspaceId: response.insertedId.toString(),
        name: workspaceData.name,
        teamId: workspaceData.id,
      });
    }
    const userDataPromises = [];
    for (const item of userDataArray) {
      userDataPromises.push(
        this.userRepository.updateUserById(new ObjectId(item._id), item),
      );
    }
    await Promise.all(userDataPromises);
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
    const workspace = await this.IsWorkspaceAdminOrEditor(id);
    const data = await this.workspaceRepository.update(id, updates);
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
      const userDataArray = await this.userRepository.findUsersByIdArray(
        updatedIdArray,
      );
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
    }
    return data;
  }

  /**
   * Deletes a workspace from the database by UUID
   * @param {string} id
   * @returns {Promise<DeleteWriteOpResultObject>} result of the delete operation
   */
  async delete(id: string): Promise<DeleteResult> {
    await this.checkAdminRole(id);
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
    const userDataArray = await this.userRepository.findUsersByIdArray(
      updatedIdArray,
    );
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
  ): Promise<void> {
    await this.IsWorkspaceAdminOrEditor(workspaceId);
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
    await this.IsWorkspaceAdminOrEditor(workspaceId);
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
    await this.IsWorkspaceAdminOrEditor(workspaceId);
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
  ): Promise<void> {
    await this.IsWorkspaceAdminOrEditor(workspaceId);
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
    await this.IsWorkspaceAdminOrEditor(workspaceId);
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
  ): Promise<void> {
    await this.IsWorkspaceAdminOrEditor(workspaceId);
    await this.workspaceRepository.updateEnvironmentinWorkspace(
      workspaceId,
      environmentId,
      name,
    );
    return;
  }

  async inviteUserInWorkspaceEmail(payload: WorkspaceInviteMailDto) {
    const currentUser = await this.contextService.get("user");
    const transporter = nodemailer.createTransport({
      service: EmailServiceProvider.GMAIL,
      auth: {
        user: this.configService.get("app.senderEmail"),
        pass: this.configService.get("app.senderPassword"),
      },
    });
    const handlebarOptions = {
      //view engine contains default and partial templates
      viewEngine: {
        defaultLayout: "",
      },
      viewPath: path.resolve(__dirname, "..", "..", "views"),
    };
    transporter.use("compile", hbs(handlebarOptions));
    const promiseArray = [];
    for (const user of payload.users) {
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: user.email,
        text: "User Invited",
        template: "inviteWorkspaceEmail",
        context: {
          firstname: user.name,
          username: currentUser.name,
          workspacename: payload.workspaceName,
        },
        subject: `${currentUser.name} has invited you to the workspace "${payload.workspaceName}"`,
      };
      promiseArray.push(transporter.sendMail(mailOptions));
    }
    await Promise.all(promiseArray);
  }

  async addUserInWorkspace(payload: AddUserInWorkspaceDto): Promise<object> {
    const workspaceData = await this.workspaceRepository.get(
      payload.workspaceId,
    );
    await this.checkAdminRole(payload.workspaceId);
    await this.roleCheck(payload.role);
    const usersExist = [];
    const usersNotExist = [];
    const alreadyWorkspaceMember = [];
    for (const emailId of payload.users) {
      const teamMember = await this.isTeamMember(
        workspaceData.team.id,
        emailId,
      );
      if (teamMember) {
        const workspaceMember = await this.isWorkspaceMember(
          payload.workspaceId,
          teamMember,
        );
        if (workspaceMember) {
          alreadyWorkspaceMember.push(emailId);
        } else {
          usersExist.push(emailId);
        }
      } else {
        usersNotExist.push(emailId);
      }
    }
    for (const emailId of usersExist) {
      const userData = await this.userRepository.getUserByEmail(emailId);
      const userWorkspaces = [...userData.workspaces];
      userWorkspaces.push({
        workspaceId: workspaceData._id.toString(),
        teamId: workspaceData.team.id,
        name: workspaceData.name,
      });
      const updatedUserParams = {
        workspaces: userWorkspaces,
      };
      await this.userRepository.updateUserById(userData._id, updatedUserParams);
      const workspaceUsers = [...workspaceData.users];
      workspaceUsers.push({
        role: payload.role,
        id: userData._id.toString(),
      });
      const updatedWorkspaceParams = {
        users: workspaceUsers,
      };
      await this.workspaceRepository.updateWorkspaceById(
        new ObjectId(payload.workspaceId),
        updatedWorkspaceParams,
      );
    }
    const userExistData = [];
    for (const email of usersExist) {
      const userData = await this.userRepository.getUserByEmail(email);
      userExistData.push(userData);
    }
    await this.inviteUserInWorkspaceEmail({
      users: userExistData,
      workspaceName: workspaceData.name,
    });
    const response = {
      notExistInTeam: usersNotExist,
      existInWorkspace: alreadyWorkspaceMember,
    };
    return response;
  }

  async removeUserFromWorkspace(
    payload: removeUserFromWorkspaceDto,
  ): Promise<WithId<User>> {
    await this.isWorkspaceAdmin(payload.workspaceId, payload.userId);
    const lastWorkspaceofTeam = await this.isLastTeamWorkspace(
      payload.workspaceId,
      payload.userId,
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
    const userTeams = [...userData.teams];
    let updatedUserTeams;
    if (lastWorkspaceofTeam) {
      updatedUserTeams = userTeams.filter(
        (team) => team.id.toString() !== workspaceData.team.id,
      );
      const teamData = await this.teamRepository.findTeamByTeamId(
        new ObjectId(workspaceData.team.id),
      );
      const teamUsers = [...teamData.users];
      const updatedTeamUsers = teamUsers.filter(
        (user) => user.id !== payload.userId,
      );
      const updatedTeamParams = {
        users: updatedTeamUsers,
      };
      await this.teamRepository.updateTeamById(
        new ObjectId(workspaceData.team.id),
        updatedTeamParams,
      );
    }
    const updatedUserParams = {
      workspaces: updatedUserWorkspaces,
      teams: lastWorkspaceofTeam ? updatedUserTeams : userTeams,
    };
    const response = await this.userRepository.updateUserById(
      new ObjectId(payload.userId),
      updatedUserParams,
    );

    return response;
  }

  async changeUserRole(payload: UserRoleInWorkspcaeDto) {
    await this.isWorkspaceAdmin(payload.workspaceId, payload.userId);
    await this.roleCheck(payload.role);
    const workspaceData = await this.workspaceRepository.get(
      payload.workspaceId,
    );
    const workspaceUsers = [...workspaceData.users];
    for (let index = 0; index < workspaceUsers.length; index++) {
      if (workspaceUsers[index].id === payload.userId) {
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
    return response;
  }

  async getAllWorkspaceUsers(
    workspaceId: string,
  ): Promise<workspaceUsersResponseDto[]> {
    const workspaceData = await this.workspaceRepository.get(workspaceId);
    const workspaceUsers = [...workspaceData.users];
    const updatedIdArray = [];
    for (const item of workspaceUsers) {
      if (!isString(item.id)) {
        updatedIdArray.push(item.id);
        continue;
      }
      updatedIdArray.push(new ObjectId(item.id));
    }
    const userDataArray = await this.userRepository.findUsersByIdArray(
      updatedIdArray,
    );
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
}
