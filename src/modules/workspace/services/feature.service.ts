import { BadRequestException, Injectable } from "@nestjs/common";
import { DeleteResult, InsertOneResult, UpdateResult, WithId } from "mongodb";
import { ContextService } from "@src/modules/common/services/context.service";
import { AddFeatureDto, UpdateFeatureDto } from "../payloads/feature.payload";
import { Feature } from "@src/modules/common/models/feature.model";
import { FeatureRepository } from "../repositories/feature.repository";

/**
 * Feature Service
 */

@Injectable()
export class FeatureService {
  constructor(
    private readonly contextService: ContextService,
    private readonly featureRepository: FeatureRepository,
  ) {}

  async addFeature(
    addFeatureDto: AddFeatureDto,
  ): Promise<InsertOneResult<Feature>> {
    const user = this.contextService.get("user");
    const featureData = await this.featureRepository.getFeatureByName(
      addFeatureDto.name,
    );
    if (featureData) {
      throw new BadRequestException(
        "Feature with this name already exists. Please choose another one.",
      );
    }
    const newFeature: Feature = {
      name: addFeatureDto.name,
      isEnabled: false,
      createdBy: user._id,
      updatedBy: user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const feature = await this.featureRepository.addFeature(newFeature);
    return feature;
  }

  async getFeature(name: string): Promise<WithId<Feature>> {
    const data = await this.featureRepository.getFeatureByName(name);
    if (!data) {
      throw new BadRequestException("Feature not found");
    }
    return data;
  }

  async deleteFeature(name: string): Promise<DeleteResult> {
    const data = await this.featureRepository.deleteFeature(name);
    return data;
  }

  async updateFeature(
    name: string,
    updateFeatureDto: UpdateFeatureDto,
  ): Promise<UpdateResult> {
    const data = await this.featureRepository.updateFeature(
      name,
      updateFeatureDto,
    );
    return data;
  }
}
