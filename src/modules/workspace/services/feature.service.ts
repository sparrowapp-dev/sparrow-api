import { BadRequestException, Injectable } from "@nestjs/common";
import {
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";

// ---- Service

// ---- Model & Payload
import { AddFeatureDto, UpdateFeatureDto } from "../payloads/feature.payload";
import { Feature } from "@src/modules/common/models/feature.model";

// ---- Repository
import { FeatureRepository } from "../repositories/feature.repository";

/**
 * Feature Service
 * This class handles business logic for managing features,
 * including adding, retrieving, updating, and deleting features.
 */

@Injectable()
export class FeatureService {
  constructor(private readonly featureRepository: FeatureRepository) {}

  /**
   * Adds a new feature.
   *
   * @param addFeatureDto - The data transfer object containing the feature details.
   * @returns The result of the insert operation.
   * @throws BadRequestException if a feature with the same name already exists.
   */
  async addFeature(
    addFeatureDto: AddFeatureDto,
    userId: ObjectId,
  ): Promise<InsertOneResult<Feature>> {
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
      isEnabled: addFeatureDto.isEnabled,
      createdBy: userId.toString(),
      updatedBy: userId.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const feature = await this.featureRepository.addFeature(newFeature);
    return feature;
  }

  /**
   * Retrieves a feature by its name.
   *
   * @param name - Name of the feature.
   * @returns The feature with the specified name.
   * @throws BadRequestException if the feature is not found.
   */
  async getFeature(name: string): Promise<WithId<Feature>> {
    const data = await this.featureRepository.getFeatureByName(name);
    if (!data) {
      throw new BadRequestException("Feature not found");
    }
    return data;
  }

  /**
   * Deletes a feature by its name.
   *
   * @param name - Name of the feature to be deleted.
   * @returns The result of the delete operation.
   */
  async deleteFeature(name: string): Promise<DeleteResult> {
    const data = await this.featureRepository.deleteFeature(name);
    return data;
  }

  /**
   * Updates a feature by its name.
   *
   * @param name - Name of the feature to be updated.
   * @param updateFeatureDto - The data transfer object containing the updated feature details.
   * @returns The result of the update operation.
   */
  async updateFeature(
    name: string,
    updateFeatureDto: UpdateFeatureDto,
    userId: ObjectId,
  ): Promise<UpdateResult> {
    const data = await this.featureRepository.updateFeature(
      name,
      updateFeatureDto,
      userId,
    );
    return data;
  }

  /**
   * Retrieves all features.
   *
   * @returns An array of all features.
   * @throws BadRequestException if no features are found.
   */
  async getAllFeature(): Promise<WithId<Feature>[]> {
    const data = await this.featureRepository.getAllFeatures();
    if (!data) {
      throw new BadRequestException("Feature not found");
    }
    return data;
  }
}
