import { Injectable } from "@nestjs/common";
import { InsertOneResult } from "mongodb";
import { ContextService } from "@src/modules/common/services/context.service";
import { createBranchDto } from "../payloads/branch.payload";
import { Branch } from "@src/modules/common/models/branch.model";
import { BranchRepository } from "../repositories/branch.repository";

/**
 * Branch Service
 */

@Injectable()
export class BranchService {
  constructor(
    private readonly contextService: ContextService,
    // private readonly featureRepository: FeatureRepository,
    private readonly branchRepository: BranchRepository,
  ) {}

  async createBranch(
    createBranchDto: createBranchDto,
  ): Promise<InsertOneResult<Branch>> {
    const user = this.contextService.get("user");
    const newBranch: Branch = {
      name: createBranchDto.name,
      items: createBranchDto.items,
      createdBy: user._id,
      updatedBy: user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const branch = await this.branchRepository.addBranch(newBranch);
    return branch;
  }
}
