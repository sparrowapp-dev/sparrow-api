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
import {
  Testflow,
  TestflowSchedular,
  TestFlowSchedularRunHistory,
} from "@src/modules/common/models/testflow.model";
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

  // Remove a single run history entry from a schedule in a testflow by runHistoryId
  async removeSchedularRunHistory(
    testflowId: string,
    schedularId: string,
    runHistoryId: string,
    userId: ObjectId,
  ): Promise<UpdateResult> {
    return this.db.collection(Collections.TESTFLOW).updateOne(
      { _id: new ObjectId(testflowId) },
      {
        $pull: {
          "schedules.$[elem].schedularRunHistory": { id: runHistoryId },
        },
        $set: {
          updatedAt: new Date(),
          updatedBy: userId.toString(),
        },
      },
      {
        arrayFilters: [{ "elem.id": schedularId }],
      },
    );
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
   * Fetches testflows from database by UUID
   * @param {string[]} testflowIds
   * @returns {Promise<Team>} queried team data
   */
  async getTestflowsByIds(testflowIds: string[]): Promise<WithId<Testflow>[]> {
    const testflows = await this.db
      .collection<Testflow>(Collections.TESTFLOW)
      .find({ _id: { $in: testflowIds.map((id) => new ObjectId(id)) } })
      .toArray();
    if (!testflows) {
      throw new BadRequestException(
        "The testflows with that ids could not be found.",
      );
    }
    return testflows;
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

  // Add new schedular to Testflow by _id
  async addSchedular(
    testflowId: string,
    schedularData: TestflowSchedular,
  ): Promise<UpdateResult> {
    return this.db.collection(Collections.TESTFLOW).updateOne(
      { _id: new ObjectId(testflowId) },
      {
        $push: { schedules: schedularData },
        $set: { updatedAt: new Date() },
      },
    );
  }

  // Update schedular details by schedular id within a Testflow document
  async updateSchedular(
    testflowId: string,
    schedularId: string,
    updatedSchedular: TestflowSchedular,
  ): Promise<UpdateResult> {
    // Ensure updatedAt is set
    updatedSchedular.updatedAt = new Date();
    return this.db
      .collection(Collections.TESTFLOW)
      .updateOne(
        { _id: new ObjectId(testflowId) },
        { $set: { "schedules.$[elem]": updatedSchedular } },
        { arrayFilters: [{ "elem.id": schedularId }] },
      );
  }

  // Remove schedular by schedular id inside Testflow document
  async removeSchedular(
    testflowId: string,
    schedularId: string,
    userId: ObjectId,
  ): Promise<UpdateResult> {
    return this.db.collection(Collections.TESTFLOW).updateOne(
      { _id: new ObjectId(testflowId) },
      {
        $pull: { schedules: { id: schedularId } },
        $set: { updatedAt: new Date(), updatedBy: userId.toString() },
      },
    );
  }

  async updateSchedularExecution(
    testflowId: string,
    schedularId: string,
    runHistoryItem: TestFlowSchedularRunHistory,
  ): Promise<UpdateResult> {
    const nowUtc = new Date().toISOString();
    if (!testflowId || !schedularId) {
      throw new Error("Both testflowId and schedularId are required");
    }
    return this.db.collection(Collections.TESTFLOW).updateOne(
      { _id: new ObjectId(testflowId) },
      {
        $inc: { "schedules.$[elem].executedCount": 1 },
        $set: {
          "schedules.$[elem].lastExecuted": nowUtc,
          updatedAt: nowUtc,
        },
        $push: {
          "schedules.$[elem].schedularRunHistory": {
            $each: [runHistoryItem],
            $position: 0, // newest first
          },
        },
      },
      {
        arrayFilters: [{ "elem.id": schedularId }],
      },
    );
  }

  /**
   * Edit a schedular execution (run history item) in a testflow's schedule.
   * @param {string} testflowId - The testflow document ID.
   * @param {string} schedularId - The schedule ID.
   * @param {Partial<TestFlowSchedularRunHistory>} updatedRunHistory - The updated fields for the run history item.
   * @returns {Promise<UpdateResult>} - The result of the update operation.
   */
  async editSchedularExecution(
    testflowId: string,
    schedularId: string,
    updatedRunHistory: Partial<TestFlowSchedularRunHistory>,
  ): Promise<UpdateResult> {
    if (!testflowId || !schedularId || !updatedRunHistory.id) {
      throw new Error("testflowId, schedularId, and runHistoryId are required");
    }
    // Build the update object for only the provided fields
    const setObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(updatedRunHistory)) {
      setObj[`schedules.$[elem].schedularRunHistory.$[run].${key}`] = value;
    }
    setObj["updatedAt"] = new Date();
    return this.db.collection(Collections.TESTFLOW).updateOne(
      { _id: new ObjectId(testflowId) },
      { $set: setObj },
      {
        arrayFilters: [
          { "elem.id": schedularId },
          { "run.id": updatedRunHistory.id },
        ],
      },
    );
  }


  async updateSchedularStatus(
    testflowId: string,
    schedularId: string,
    isActive = false,
  ): Promise<UpdateResult> {
    const now = new Date();
    if (!testflowId || !schedularId) {
      throw new Error("Both testflowId and schedularId are required");
    }
    return this.db.collection(Collections.TESTFLOW).updateOne(
      { _id: new ObjectId(testflowId) },
      {
        $set: {
          "schedules.$[elem].isActive": isActive,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [{ "elem.id": schedularId }],
      },
    );
  }

  async getSchedularById(
    testflowId: string,
    schedularId: string,
  ): Promise<TestflowSchedular | null> {
    if (!testflowId || !schedularId) {
      throw new Error("Both testflowId and schedularId are required");
    }
    const result = await this.db.collection(Collections.TESTFLOW).findOne(
      { _id: new ObjectId(testflowId), "schedules.id": schedularId },
      {
        projection: {
          schedules: {
            $filter: {
              input: "$schedules",
              as: "schedule",
              cond: { $eq: ["$$schedule.id", schedularId] },
            },
          },
        },
      },
    );
    if (!result || !result.schedules || result.schedules.length === 0) {
      return null;
    }
    return result.schedules[0];
  }

  async getAll(): Promise<WithId<Testflow>[]> {
    const data = await this.db
      .collection<Testflow>(Collections.TESTFLOW)
      .find({})
      .toArray();
    if (!data || data.length === 0) {
      throw new BadRequestException("No Testflow data found");
    }
    return data;
  }
}
