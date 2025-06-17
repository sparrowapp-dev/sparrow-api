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

// ---- Payload & model
import { Testflow } from "@src/modules/common/models/testflow.model";
import { UpdateTestflowDto } from "../payloads/testflow.payload";

@Injectable()
export class TestflowRepository {
  /**
   * Creates an instance of the TestflowRepository.
   *
   * @param {Db} db - MongoDB database connection.
   */
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Inserts a new Testflow into the MongoDB collection.
   *
   * @param {Testflow} testflow - The Testflow object to be inserted.
   * @returns {Promise<InsertOneResult>} - The result of the insert operation.
   *
   * @description This method adds a new Testflow document to the TESTFLOW collection.
   */
  async addTestflow(testflow: Testflow): Promise<InsertOneResult> {
    const response = await this.db
      .collection<Testflow>(Collections.TESTFLOW)
      .insertOne(testflow);
    return response;
  }

  /**
   * Retrieves a Testflow document by its ID.
   *
   * @param {string} id - The MongoDB ObjectId of the Testflow to be retrieved.
   * @returns {Promise<WithId<Testflow>>} - The retrieved Testflow document.
   * @throws {BadRequestException} - If the Testflow with the provided ID is not found.
   *
   * @description This method fetches a Testflow from the TESTFLOW collection using its unique ID.
   */
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

  /**
   * Deletes a Testflow document by its ID.
   *
   * @param {string} id - The MongoDB ObjectId of the Testflow to be deleted.
   * @returns {Promise<DeleteResult>} - The result of the delete operation.
   *
   * @description This method removes a Testflow from the TESTFLOW collection based on the provided ID.
   */
  async delete(id: string): Promise<DeleteResult> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection(Collections.TESTFLOW)
      .deleteOne({ _id });
    return data;
  }

  /**
   * Updates an existing Testflow document by its ID.
   *
   * @param {string} id - The MongoDB ObjectId of the Testflow to be updated.
   * @param {Partial<UpdateTestflowDto>} updateTestflowDto - The update payload containing fields to be modified.
   * @returns {Promise<UpdateResult>} - The result of the update operation.
   *
   * @description This method updates a Testflow document with the given ID.
   * It merges the update data from `updateTestflowDto` with additional metadata such as the updated timestamp and the user who performed the update.
   */
  async update(
    id: string,
    updateTestflowDto: Partial<UpdateTestflowDto>,
    userId: ObjectId,
  ): Promise<UpdateResult> {
    const testflowId = new ObjectId(id);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: userId.toString(),
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
