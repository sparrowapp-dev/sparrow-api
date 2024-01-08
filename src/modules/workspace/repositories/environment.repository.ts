import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import {
  Db,
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";

import { Environment } from "@src/modules/common/models/environment.model";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { UpdateEnvironmentDto } from "../payloads/environment.payload";
import { ContextService } from "@src/modules/common/services/context.service";

@Injectable()
export class EnvironmentRepository {
  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
    private readonly contextService: ContextService,
  ) {}

  async addEnvironment(environment: Environment): Promise<InsertOneResult> {
    const response = await this.db
      .collection<Environment>(Collections.ENVIRONMENT)
      .insertOne(environment);
    return response;
  }

  async get(id: string): Promise<WithId<Environment>> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection<Environment>(Collections.ENVIRONMENT)
      .findOne({ _id });
    if (!data) {
      throw new BadRequestException("Environment Not Found");
    }
    return data;
  }

  async delete(id: string): Promise<DeleteResult> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection(Collections.ENVIRONMENT)
      .deleteOne({ _id });
    return data;
  }

  async update(
    id: string,
    updateEnvironmentDto: UpdateEnvironmentDto,
  ): Promise<UpdateResult> {
    const environmentId = new ObjectId(id);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: this.contextService.get("user").name,
    };
    const data = await this.db
      .collection(Collections.ENVIRONMENT)
      .updateOne(
        { _id: environmentId },
        { $set: { ...updateEnvironmentDto, ...defaultParams } },
      );
    return data;
  }
}
