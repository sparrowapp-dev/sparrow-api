import { Inject, Injectable } from "@nestjs/common";

import {
  Db,
  DeleteResult,
  InsertOneResult,
  UpdateResult,
  WithId,
} from "mongodb";

import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { ContextService } from "@src/modules/common/services/context.service";
import { Feature } from "@src/modules/common/models/feature.model";
import { UpdateFeatureDto } from "../payloads/feature.payload";

@Injectable()
export class FeatureRepository {
  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
    private readonly contextService: ContextService,
  ) {}

  async addFeature(feature: Feature): Promise<InsertOneResult<Feature>> {
    const response = await this.db
      .collection<Feature>(Collections.FEATURES)
      .insertOne(feature);
    return response;
  }

  async getFeatureByName(name: string): Promise<WithId<Feature>> {
    const data = await this.db
      .collection<Feature>(Collections.FEATURES)
      .findOne({ name });
    return data;
  }

  async deleteFeature(name: string): Promise<DeleteResult> {
    const data = await this.db
      .collection(Collections.FEATURES)
      .deleteOne({ name });
    return data;
  }

  async updateFeature(
    name: string,
    updateFeatureDto: UpdateFeatureDto,
  ): Promise<UpdateResult> {
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: this.contextService.get("user")._id,
    };
    const data = await this.db
      .collection(Collections.FEATURES)
      .updateOne(
        { name: name },
        { $set: { ...updateFeatureDto, ...defaultParams } },
      );
    return data;
  }
}
