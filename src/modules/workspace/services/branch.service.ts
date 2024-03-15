import { Injectable } from "@nestjs/common";
import { InsertOneResult, ObjectId, WithId } from "mongodb";
import { ContextService } from "@src/modules/common/services/context.service";
import { createBranchDto } from "../payloads/branch.payload";
import { Branch } from "@src/modules/common/models/branch.model";
import { BranchRepository } from "../repositories/branch.repository";
import { CollectionItem } from "@src/modules/common/models/collection.model";
import { WorkspaceService } from "./workspace.service";

/**
 * Branch Service
 */

@Injectable()
export class BranchService {
  constructor(
    private readonly contextService: ContextService,
    private readonly branchRepository: BranchRepository,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async createBranch(
    createBranchDto: createBranchDto,
  ): Promise<InsertOneResult<Branch>> {
    const user = this.contextService.get("user");
    const newBranch: Branch = {
      name: createBranchDto.name,
      items: createBranchDto.items,
      collectionId: new ObjectId(createBranchDto.collectionId),
      createdBy: user._id,
      updatedBy: user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const branch = await this.branchRepository.addBranch(newBranch);
    return branch;
  }

  async updateBranch(
    workspaceId: string,
    branchId: string,
    items: CollectionItem[],
  ): Promise<void> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(workspaceId);
    const updatedParams = {
      items: items,
      updatedAt: new Date(),
      updatedBy: this.contextService.get("user")._id,
    };
    await this.branchRepository.updateBranchById(branchId, updatedParams);
  }

  async getBranch(branchId: string): Promise<WithId<Branch>> {
    const branch = await this.branchRepository.getBranch(branchId);
    return branch;
  }
}
