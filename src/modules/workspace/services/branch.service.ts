import { Injectable } from "@nestjs/common";
import { InsertOneResult, ObjectId, WithId } from "mongodb";

// ---- Payload & Model
import { createBranchDto } from "../payloads/branch.payload";
import { Branch } from "@src/modules/common/models/branch.model";
import { CollectionItem } from "@src/modules/common/models/collection.model";

// ---- Service
import { WorkspaceService } from "./workspace.service";

// ---- Repository
import { BranchRepository } from "../repositories/branch.repository";

/**
 * Service to handle business logic related to branches.
 * Provides methods to create, update, and retrieve branches while interacting
 * with repositories and other dependent services.
 */

@Injectable()
export class BranchService {
  /**
   * Constructor for BranchService.
   * @param branchRepository - Repository to interact with the branch data store.
   * @param workspaceService - Service to handle workspace-specific validations and operations.
   */
  constructor(
    private readonly branchRepository: BranchRepository,
    private readonly workspaceService: WorkspaceService,
  ) {}

  /**
   * Creates a new branch based on the provided details.
   * @param createBranchDto - DTO containing information about the branch to be created.
   * @returns The result of the branch insertion operation.
   */
  async createBranch(
    createBranchDto: createBranchDto,
    userId: ObjectId,
  ): Promise<InsertOneResult<Branch>> {
    const newBranch: Branch = {
      name: createBranchDto.name,
      items: createBranchDto.items,
      collectionId: new ObjectId(createBranchDto.collectionId),
      createdBy: userId.toString(),
      updatedBy: userId.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const branch = await this.branchRepository.addBranch(newBranch);
    return branch;
  }

  /**
   * Updates an existing branch's items.
   * Verifies the user's role in the workspace before updating.
   * @param workspaceId - The ID of the workspace containing the branch.
   * @param branchId - The ID of the branch to be updated.
   * @param items - The updated list of collection items for the branch.
   * @returns A promise that resolves when the update is complete.
   */
  async updateBranch(
    workspaceId: string,
    branchId: string,
    items: CollectionItem[],
    userId: ObjectId,
  ): Promise<void> {
    await this.workspaceService.IsWorkspaceAdminOrEditor(workspaceId, userId);
    const updatedParams = {
      items: items,
      updatedAt: new Date(),
      updatedBy: userId.toString(),
    };
    await this.branchRepository.updateBranchById(branchId, updatedParams);
  }

  /**
   * Retrieves a branch by its ID.
   * @param branchId - The ID of the branch to retrieve.
   * @returns The branch document with the specified ID.
   */
  async getBranch(branchId: string): Promise<WithId<Branch>> {
    const branch = await this.branchRepository.getBranch(branchId);
    return branch;
  }
}
