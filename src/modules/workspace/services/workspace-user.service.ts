import { Injectable } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { WorkspaceRole } from "@src/modules/common/enum/roles.enum";
import { WorkspaceDto } from "@src/modules/common/models/workspace.model";
import { UserRepository } from "../../identity/repositories/user.repository";
import { WorkspaceRepository } from "@src/modules/workspace/repositories/workspace.repository";
import { isString } from "class-validator";
import { SelectedWorkspaces } from "@src/modules/identity/payloads/teamUser.payload";
/**
 * Workspace User Service
 */
@Injectable()
export class WorkspaceUserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async addUserInWorkspace(
    workspaceArray: SelectedWorkspaces[],
    userId: string,
    role: string,
  ): Promise<void> {
    const updatedIdArray = [];
    for (const item of workspaceArray) {
      if (!isString(item.id)) {
        updatedIdArray.push(item.id);
        continue;
      }
      updatedIdArray.push(new ObjectId(item.id));
    }
    const workspaceDataArray =
      await this.workspaceRepository.findWorkspacesByIdArray(updatedIdArray);
    if (role === WorkspaceRole.ADMIN) {
      const user = await this.userRepository.getUserById(userId);
      for (let index = 0; index < workspaceDataArray.length; index++) {
        workspaceDataArray[index].users.push({
          role: WorkspaceRole.ADMIN,
          id: userId,
        });
        workspaceDataArray[index].admins.push({
          id: userId,
          name: user.name,
        });
      }
    } else {
      for (let index = 0; index < workspaceDataArray.length; index++) {
        for (const item of workspaceArray) {
          if (workspaceDataArray[index]._id.toString() === item.id.toString()) {
            workspaceDataArray[index].users.push({
              role: role,
              id: userId,
            });
          }
        }
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

  async removeUserFromWorkspace(
    workspaceArray: WorkspaceDto[],
    userId: string,
    role: string,
  ): Promise<void> {
    const updatedIdArray = [];
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
      workspaceDataArray[index].users = workspaceDataArray[index].users.filter(
        (item: any) => item.id.toString() !== userId,
      );
      if (role === WorkspaceRole.ADMIN) {
        workspaceDataArray[index].admins = workspaceDataArray[
          index
        ].admins.filter((item: any) => item.id.toString() !== userId);
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

  async updateAdminRoleInWorkspace(
    workspaceArray: WorkspaceDto[],
    userId: string,
  ): Promise<void> {
    const updatedIdArray = [];
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
      const usersLength = workspaceDataArray[index].users;
      let count = 0;
      for (let flag = 0; flag < usersLength.length; flag++) {
        if (
          workspaceDataArray[index].users[flag].id.toString() ===
          userId.toString()
        ) {
          workspaceDataArray[index].users[flag].role = WorkspaceRole.ADMIN;
        } else {
          count++;
        }
      }
      if (count === usersLength.length) {
        workspaceDataArray[index].users.push({
          id: userId,
          role: WorkspaceRole.ADMIN,
        });
      }
      const user = await this.userRepository.getUserById(userId);
      workspaceDataArray[index].admins.push({
        id: userId,
        name: user.name,
      });
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

  async demoteAdminInWorkspace(workspaceArray: WorkspaceDto[], userId: string) {
    const updatedIdArray = [];
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
      const usersLength = workspaceDataArray[index].users;
      for (let flag = 0; flag < usersLength.length; flag++) {
        if (
          workspaceDataArray[index].users[flag].id.toString() ===
          userId.toString()
        ) {
          workspaceDataArray[index].users[flag].role = WorkspaceRole.EDITOR;
        }
      }
      workspaceDataArray[index].admins = workspaceDataArray[
        index
      ].admins.filter((item: any) => item.id.toString() !== userId);
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
}
