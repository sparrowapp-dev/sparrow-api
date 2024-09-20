// ---- Nest
import { BadRequestException, Inject, Injectable } from "@nestjs/common";

// ---- Mongo
import {
  Db,
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";

// ---- Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";

// ---- Services
import { ContextService } from "@src/modules/common/services/context.service";

// Payload & model
import { Testflow } from "@src/modules/common/models/testflow.model";
import { UpdateTestflowDto } from "../payloads/testflow.payload";

@Injectable()
export class TestflowRepository {
  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
    private readonly contextService: ContextService,
  ) {}

  async addTestflow(testflow: Testflow): Promise<InsertOneResult> {
    const response = await this.db
      .collection<Testflow>(Collections.TESTFLOW)
      .insertOne(testflow);
    return response;
  }

  async get(id: string): Promise<WithId<Testflow>> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection<Testflow>(Collections.TESTFLOW)
      .findOne({ _id });
    if (!data) {
      throw new BadRequestException("Testflow Not Found");
    }
    return data;
  }

  async delete(id: string): Promise<DeleteResult> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection(Collections.TESTFLOW)
      .deleteOne({ _id });
    return data;
  }

  async update(
    id: string,
    updateTestflowDto: Partial<UpdateTestflowDto>,
  ): Promise<UpdateResult> {
    const testflowId = new ObjectId(id);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: this.contextService.get("user")._id.toString(),
    };
    const data = await this.db
      .collection(Collections.TESTFLOW)
      .updateOne(
        { _id: testflowId },
        { $set: { ...updateTestflowDto, ...defaultParams } },
      );
    return data;
  }
}
