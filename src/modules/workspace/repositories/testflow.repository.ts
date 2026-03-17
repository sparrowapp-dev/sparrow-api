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
  TestflowDataSetItem,
  TestflowSchedular,
  TestflowSchedularDataSetHistory,
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

  // Remove a single run history entry from a schedule in a testflow by runHistoryId
  async removeSchedularRunHistoryTestData(
    testflowId: string,
    schedularId: string,
    runHistoryId: string,
    userId: ObjectId,
  ): Promise<UpdateResult> {
    return this.db.collection(Collections.TESTFLOW).updateOne(
      { _id: new ObjectId(testflowId) },
      {
        $pull: {
          "schedules.$[elem].schedularDataSetHistory": { id: runHistoryId },
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

  async updateSchedularDataSetExecution(
    testflowId: string,
    schedularId: string,
    dataSetHistoryItem: TestflowSchedularDataSetHistory,
  ): Promise<UpdateResult> {
    const nowUtc = new Date().toISOString();
    if (!testflowId || !schedularId) {
      throw new Error("Both testflowId and schedularId are required");
    }
    const updateOperations: any = {
      $set: {
        "schedules.$[elem].lastExecuted": nowUtc,
        updatedAt: nowUtc,
      },
      $push: {
        "schedules.$[elem].schedularDataSetHistory": {
          $each: [dataSetHistoryItem],
          $position: 0, // newest first
        },
      },
    };
    return this.db
      .collection(Collections.TESTFLOW)
      .updateOne({ _id: new ObjectId(testflowId) }, updateOperations, {
        arrayFilters: [{ "elem.id": schedularId }],
      });
  }

  async editSchedularDataSetHistory(
    testflowId: string,
    schedularId: string,
    updatedDataSetHistory: Partial<TestflowSchedularDataSetHistory>,
  ): Promise<UpdateResult> {
    if (!testflowId || !schedularId || !updatedDataSetHistory.id) {
      throw new Error(
        "testflowId, schedularId, and dataSetHistoryId are required",
      );
    }
    // Build the update object for only the provided fields
    const setObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(updatedDataSetHistory)) {
      setObj[`schedules.$[elem].schedularDataSetHistory.$[dataset].${key}`] =
        value;
    }
    setObj["updatedAt"] = new Date();
    return this.db.collection(Collections.TESTFLOW).updateOne(
      { _id: new ObjectId(testflowId) },
      { $set: setObj },
      {
        arrayFilters: [
          { "elem.id": schedularId },
          { "dataset.id": updatedDataSetHistory.id },
        ],
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

  /**
   * Edit a schedular execution (run history item) in a testflow's schedule.
   * @param {string} testflowId - The testflow document ID.
   * @param {string} schedularId - The schedule ID.
   * @param {Partial<TestFlowSchedular>} updatedSchedular - The updated fields for the schedule item.
   * @returns {Promise<UpdateResult>} - The result of the update operation.
   */
  async editSchedular(
    testflowId: string,
    schedularId: string,
    updatedSchedular: Partial<TestflowSchedular>,
  ): Promise<UpdateResult> {
    if (!testflowId || !schedularId) {
      throw new Error("testflowId and schedularId are required");
    }
    // Build the update object for only the provided fields
    const setObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(updatedSchedular)) {
      setObj[`schedules.$[elem].${key}`] = value;
    }
    return this.db.collection(Collections.TESTFLOW).updateOne(
      { _id: new ObjectId(testflowId) },
      { $set: setObj },
      {
        arrayFilters: [{ "elem.id": schedularId }],
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

  /**
   * Add a new dataset to a testflow
   * @param testflowId - The ID of the testflow
   * @param datasetItem - The dataset item to add
   * @returns TestflowDataSetItem
   */
  async addDataset(
    testflowId: string,
    datasetItem: TestflowDataSetItem,
  ): Promise<TestflowDataSetItem> {
    const result = await this.db
      .collection(Collections.TESTFLOW)
      .findOneAndUpdate(
        { _id: new ObjectId(testflowId) },
        {
          $push: { datasets: datasetItem } as any,
          $set: { updatedAt: new Date() },
        },
        {
          returnDocument: "after",
        },
      );
    if (!result) {
      throw new Error("Testflow not found");
    }
    return datasetItem;
  }

  /**
   * Remove a dataset from a testflow by dataset ID
   * @param testflowId - The ID of the testflow
   * @param datasetId - The ID of the dataset to remove
   * @returns UpdateResult
   */
  async removeDataset(
    testflowId: string,
    datasetId: string,
  ): Promise<UpdateResult> {
    return this.db.collection(Collections.TESTFLOW).updateOne(
      { _id: new ObjectId(testflowId) },
      {
        $pull: { datasets: { id: datasetId } },
        $set: { updatedAt: new Date() },
      },
    );
  }

  /**
   * Get a specific dataset from a testflow
   * @param testflowId - The ID of the testflow
   * @param datasetId - The ID of the dataset to retrieve
   * @returns The dataset item or null
   */
  async getDataset(
    testflowId: string,
    datasetId: string,
  ): Promise<TestflowDataSetItem> {
    const result = await this.db.collection(Collections.TESTFLOW).findOne(
      {
        _id: new ObjectId(testflowId),
        "datasets.id": datasetId,
      },
      {
        projection: {
          datasets: {
            $elemMatch: { id: datasetId },
          },
        },
      },
    );

    return result?.datasets?.[0] || null;
  }

  /**
   * Update specific fields of a dataset in a testflow
   * @param testflowId - The ID of the testflow
   * @param datasetId - The ID of the dataset to update
   * @param updateData - The fields to update (e.g., name, fileUrl, updatedAt, updatedBy)
   * @returns The update result
   */
  async updateDataset(
    testflowId: string,
    datasetId: string,
    updateData: Partial<
      Pick<TestflowDataSetItem, "name" | "item" | "updatedAt" | "updatedBy">
    >,
  ): Promise<TestflowDataSetItem | null> {
    const updateFields: any = {};
    if (updateData.name) updateFields["datasets.$.name"] = updateData.name;
    if (updateData.updatedAt)
      updateFields["datasets.$.updatedAt"] = updateData.updatedAt;
    if (updateData.updatedBy)
      updateFields["datasets.$.updatedBy"] = updateData.updatedBy;
    if (updateData.item) updateFields["datasets.$.item"] = updateData.item;
    // Perform atomic update and fetch updated dataset
    const updatedTestflow = await this.db
      .collection(Collections.TESTFLOW)
      .findOneAndUpdate(
        {
          _id: new ObjectId(testflowId),
          "datasets.id": datasetId,
        },
        { $set: updateFields },
        {
          returnDocument: "after",
          projection: { datasets: 1 },
        },
      );
    return updatedTestflow?.value?.datasets || null;
  }

  /**
   * Update specific fields of a dataset in a testflow
   * @param testflowId - The ID of the testflow
   * @param datasetName - The Name of the dataset to update
   * @param updateData - The fields to update (e.g., name, fileUrl, updatedAt, updatedBy)
   * @returns The update result
   */
  async updateDatasetByName(
    testflowId: string,
    datasetName: string,
    updateData: Partial<
      Pick<TestflowDataSetItem, "name" | "item" | "updatedAt" | "updatedBy">
    >,
  ): Promise<TestflowDataSetItem | null> {
    const updateFields: any = {};
    if (updateData.name) updateFields["datasets.$.name"] = updateData.name;
    if (updateData.item) updateFields["datasets.$.item"] = updateData.item;
    if (updateData.updatedAt)
      updateFields["datasets.$.updatedAt"] = updateData.updatedAt;
    if (updateData.updatedBy)
      updateFields["datasets.$.updatedBy"] = updateData.updatedBy;
    // Perform atomic update based on dataset name
    const updatedTestflow = await this.db
      .collection(Collections.TESTFLOW)
      .findOneAndUpdate(
        {
          _id: new ObjectId(testflowId),
          "datasets.name": datasetName,
        },
        { $set: updateFields },
        {
          returnDocument: "after",
          projection: { datasets: { $elemMatch: { name: datasetName } } },
        },
      );
    return updatedTestflow?.value?.datasets?.[0] || null;
  }

  /**
   * Delete a dataset from a testflow
   * @param testflowId - The ID of the testflow
   * @param datasetId - The ID of the dataset to delete
   * @returns The update result
   */
  async deleteDataset(
    testflowId: string,
    datasetId: string,
  ): Promise<{ datasets: any[] }> {
    const result = await this.db
      .collection(Collections.TESTFLOW)
      .findOneAndUpdate(
        { _id: new ObjectId(testflowId) } as any,
        {
          $pull: { datasets: { id: datasetId } },
          $set: { updatedAt: new Date() },
        } as any,
        {
          returnDocument: "after",
          projection: { datasets: 1 }, // returns all datasets
        },
      );
    return { datasets: result.value?.datasets || null };
  }

  async getTestflowsExecutionCount(start: Date, end: Date): Promise<number> {
    const testflows = await this.db
      .collection(Collections.TESTFLOW)
      .find({})
      .toArray();

    let count = 0;

    for (const testflow of testflows) {
      for (const schedule of testflow.schedules || []) {
        for (const run of schedule.schedularRunHistory || []) {
          const runDate = new Date(run.createdAt);

          if (runDate >= start && runDate <= end) {
            count += (run.successRequests || 0) + (run.failedRequests || 0);
          }
        }
      }
    }

    return count;
  }
}
