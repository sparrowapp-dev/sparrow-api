import { Inject, Injectable } from "@nestjs/common";

import { Db, InsertOneResult } from "mongodb";

import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { ContextService } from "@src/modules/common/services/context.service";
import { Branch } from "@src/modules/common/models/branch.model";

@Injectable()
export class BranchRepository {
  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
    private readonly contextService: ContextService,
  ) {}

  async addBranch(branch: Branch): Promise<InsertOneResult<Branch>> {
    const response = await this.db
      .collection<Branch>(Collections.BRANCHES)
      .insertOne(branch);
    return response;
  }
}
