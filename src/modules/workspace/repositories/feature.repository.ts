import { Inject, Injectable } from "@nestjs/common";

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

// ---- Service

// ---- Model and Payload
import { Feature } from "@src/modules/common/models/feature.model";
import { UpdateFeatureDto } from "../payloads/feature.payload";

/**
 * Repository class for Feature operations.
 *
 * This class handles database interactions for features,
 * including adding, retrieving, updating, and deleting features.
 */
@Injectable()
export class FeatureRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Adds a new feature to the database.
   *
   * @param feature - Feature to be added.
   * @returns Result of the insert operation.
   */
  async addFeature(feature: Feature): Promise<InsertOneResult<Feature>> {
    const response = await this.db
      .collection<Feature>(Collections.FEATURES)
      .insertOne(feature);
    return response;
  }

  /**
   * Retrieves a feature by its name.
   *
   * @param name - Name of the feature.
   * @returns The feature with the specified name.
   */
  async getFeatureByName(name: string): Promise<WithId<Feature>> {
    const data = await this.db
      .collection<Feature>(Collections.FEATURES)
      .findOne({ name });
    return data;
  }

  /**
   * Deletes a feature by its name.
   *
   * @param name - Name of the feature to be deleted.
   * @returns Result of the delete operation.
   */
  async deleteFeature(name: string): Promise<DeleteResult> {
    const data = await this.db
      .collection(Collections.FEATURES)
      .deleteOne({ name });
    return data;
  }

  /**
   * Updates a feature by its name.
   *
   * @param name - Name of the feature to be updated.
   * @param updateFeatureDto - Data transfer object containing the updated feature details.
   * @returns Result of the update operation.
   */
  async updateFeature(
    name: string,
    updateFeatureDto: UpdateFeatureDto,
    userId: ObjectId,
  ): Promise<UpdateResult> {
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: userId.toString(),
    };
    const data = await this.db
      .collection(Collections.FEATURES)
      .updateOne(
        { name: name },
        { $set: { ...updateFeatureDto, ...defaultParams } },
      );
    return data;
  }

  /**
   * Retrieves all features from the database.
   *
   * @returns An array of all features.
   */
  async getAllFeatures(): Promise<WithId<Feature>[]> {
    const data = await this.db
      .collection<Feature>(Collections.FEATURES)
      .find()
      .toArray();
    return data;
  }
}
