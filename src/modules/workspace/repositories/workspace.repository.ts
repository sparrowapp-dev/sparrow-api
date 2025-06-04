import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  Db,
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";
import { Workspace, WorkspaceType } from "../../common/models/workspace.model";
import { Collections } from "../../common/enum/database.collection.enum";
import {
  UpdateWorkspaceDto,
  WorkspaceDtoForIdDocument,
} from "../payloads/workspace.payload";
import { ContextService } from "../../common/services/context.service";
import { CollectionDto } from "@src/modules/common/models/collection.model";
import { EnvironmentDto } from "@src/modules/common/models/environment.model";
import { TestflowInfoDto } from "@src/modules/common/models/testflow.model";
/**
 * Models a typical response for a crud operation
 */
export interface IGenericMessageBody {
  /**
   * Status message to return
   */
  message: string;
}

/**
 * Workspace Repository
 */
@Injectable()
export class WorkspaceRepository {
  constructor(
    @Inject("DATABASE_CONNECTION")
    private db: Db,
    private contextService: ContextService,
  ) {}

  async get(id: string): Promise<WithId<Workspace>> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .findOne({ _id });
    if (!data) {
      throw new BadRequestException("Not Found");
    }
    return data;
  }

  async getPublicWorkspace(id: string): Promise<WithId<Workspace>> {
    const _id = new ObjectId(id);
    const data = await this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .findOne({ _id });

    return {
      ...data,
      users: [],
    };
  }

  async addWorkspace(params: Workspace): Promise<InsertOneResult<Document>> {
    const response = await this.db
      .collection(Collections.WORKSPACE)
      .insertOne(params);
    return response;
  }

  async findWorkspaceById(id: ObjectId) {
    const response = await this.db
      .collection(Collections.WORKSPACE)
      .findOne({ _id: id });
    return response;
  }

  async findWorkspacesByIdArray(
    IdArray: Array<ObjectId>,
  ): Promise<WithId<Workspace>[]> {
    const response = await this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .find({ _id: { $in: IdArray } })
      .toArray();
    return response;
  }

  async updateWorkspaceById(
    id: ObjectId,
    updatedWorkspace: Partial<WorkspaceDtoForIdDocument>,
  ): Promise<WithId<Workspace>> {
    const response = await this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .findOneAndUpdate(
        { _id: id },
        {
          $set: updatedWorkspace,
        },
      );
    return response.value;
  }

  /**
   * Updates an existing workspace in the database by UUID
   * @param {string} id
   * @param {Partial<Workspace>} updates
   * @returns {Promise<UpdateWriteOpResult>} result of the update operation
   */
  update(id: string, updates: UpdateWorkspaceDto) {
    const _id = new ObjectId(id);
    const defaultParams = {
      updatedAt: new Date(),
      updatedBy: this.contextService.get("user")._id,
    };
    return this.db
      .collection(Collections.WORKSPACE)
      .updateOne({ _id }, { $set: { ...updates, ...defaultParams } });
  }

  delete(id: string): Promise<DeleteResult> {
    const _id = new ObjectId(id);
    return this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .deleteOne({ _id });
  }
  async addCollectionInWorkspace(
    workspaceId: string,
    collection: CollectionDto,
  ): Promise<UpdateResult> {
    const _id = new ObjectId(workspaceId);
    return await this.db.collection(Collections.WORKSPACE).updateOne(
      { _id },
      {
        $push: {
          collection: {
            id: collection.id,
            name: collection.name,
            activeSync: collection.activeSync,
          },
        },
      },
    );
  }

  async updateCollectioninWorkspace(
    workspaceId: string,
    collectionId: string,
    name: string,
  ): Promise<UpdateResult> {
    const _id = new ObjectId(workspaceId);
    const collection_id = new ObjectId(collectionId);
    return this.db
      .collection(Collections.WORKSPACE)
      .updateOne(
        { _id, "collection.id": collection_id },
        { $set: { "collection.$.name": name } },
      );
  }
  async deleteCollectioninWorkspace(
    workspaceId: string,
    collectionsArray: CollectionDto[],
  ): Promise<UpdateResult> {
    const _id = new ObjectId(workspaceId);
    return this.db
      .collection(Collections.WORKSPACE)
      .updateOne({ _id }, { $set: { collection: collectionsArray } });
  }

  async addEnvironmentInWorkspace(
    workspaceId: string,
    environment: EnvironmentDto,
  ): Promise<UpdateResult> {
    const _id = new ObjectId(workspaceId);
    return await this.db.collection(Collections.WORKSPACE).updateOne(
      { _id },
      {
        $push: {
          environments: {
            id: environment.id,
            name: environment.name,
            type: environment.type,
          },
        },
      },
    );
  }

  async deleteEnvironmentinWorkspace(
    workspaceId: string,
    environmentsArray: EnvironmentDto[],
  ): Promise<UpdateResult> {
    const _id = new ObjectId(workspaceId);
    return this.db
      .collection(Collections.WORKSPACE)
      .updateOne({ _id }, { $set: { environments: environmentsArray } });
  }

  async updateEnvironmentinWorkspace(
    workspaceId: string,
    environmentId: string,
    name: string,
  ): Promise<UpdateResult> {
    const _id = new ObjectId(workspaceId);
    const environment_id = new ObjectId(environmentId);
    return this.db
      .collection(Collections.WORKSPACE)
      .updateOne(
        { _id, "environments.id": environment_id },
        { $set: { "environments.$.name": name } },
      );
  }

  /**
   * Adds a Testflow to the specified Workspace.
   *
   * @param {string} workspaceId - The MongoDB ObjectId of the Workspace where the Testflow will be added.
   * @param {TestflowInfoDto} testflow - The Testflow data containing the id and name to be added to the Workspace.
   * @returns {Promise<UpdateResult>} - The result of the update operation.
   *
   * @description This method pushes a new Testflow entry (id and name) to the `testflows` array of the specified Workspace.
   */
  async addTestflowInWorkspace(
    workspaceId: string,
    testflow: TestflowInfoDto,
  ): Promise<UpdateResult> {
    const _id = new ObjectId(workspaceId);
    const response = await this.db.collection(Collections.WORKSPACE).updateOne(
      { _id },
      {
        $push: {
          testflows: {
            id: testflow.id,
            name: testflow.name,
          },
        },
      },
    );
    return response;
  }

  /**
   * Deletes Testflows in the specified Workspace.
   *
   * @param {string} workspaceId - The MongoDB ObjectId of the Workspace where the Testflows will be removed.
   * @param {TestflowInfoDto[]} testflowsArray - The array of remaining Testflow data (id and name) after deletion.
   * @returns {Promise<UpdateResult>} - The result of the update operation.
   *
   * @description This method sets the `testflows` array to the provided list in the specified Workspace, effectively removing the Testflows that are not present in the new array.
   */
  async deleteTestflowInWorkspace(
    workspaceId: string,
    testflowsArray: TestflowInfoDto[],
  ): Promise<UpdateResult> {
    const _id = new ObjectId(workspaceId);
    const response = await this.db
      .collection(Collections.WORKSPACE)
      .updateOne({ _id }, { $set: { testflows: testflowsArray } });
    return response;
  }

  /**
   * Updates the name of a specific Testflow in the Workspace.
   *
   * @param {string} workspaceId - The MongoDB ObjectId of the Workspace where the Testflow is located.
   * @param {string} testflowId - The id of the Testflow whose name needs to be updated.
   * @param {string} name - The new name to update the Testflow with.
   * @returns {Promise<UpdateResult>} - The result of the update operation.
   *
   * @description This method updates the name of a Testflow in the `testflows` array in the specified Workspace, identified by the Testflow's id.
   */
  async updateTestflowInWorkspace(
    workspaceId: string,
    testflowId: string,
    name: string,
  ): Promise<UpdateResult> {
    const _id = new ObjectId(workspaceId);
    const response = await this.db
      .collection(Collections.WORKSPACE)
      .updateOne(
        { _id, "testflows.id": testflowId },
        { $set: { "testflows.$.name": name } },
      );
    return response;
  }

  async updateWorkspaceTypeById(
    id: ObjectId,
    workspaceType: WorkspaceType,
  ): Promise<WithId<Workspace>> {
    const response = await this.db
      .collection<Workspace>(Collections.WORKSPACE)
      .findOneAndUpdate(
        { _id: id },
        {
          $set: { workspaceType: workspaceType },
        },
        { returnDocument: "after" }, // ensures you get the updated doc
      );

    return response.value;
  }

  /**
   * Retrieves a paginated list of public workspaces.
   * @param page - The page number (1-based).
   * @param pageSize - The number of items per page.
   * @returns A list of public workspaces and total count.
   */
  async getPaginatedPublicWorkspaces(
    page: number,
    pageSize: number,
  ): Promise<{ workspaces: WithId<Workspace>[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const collection = this.db.collection<Workspace>(Collections.WORKSPACE);
    const [workspaces, total] = await Promise.all([
      collection
        .find({ workspaceType: WorkspaceType.PUBLIC })
        .skip(skip)
        .limit(pageSize)
        .sort({ createdAt: -1 })
        .toArray(),
      collection.countDocuments({ workspaceType: WorkspaceType.PUBLIC }),
    ]);
    return { workspaces, total };
  }

  /**
   * Searches public workspaces by name, team name, and description.
   * @param searchTerm - The search term to match against workspace names, team names, and descriptions.
   * @param page - The page number for pagination.
   * @param pageSize - The number of results per page.
   * @returns An object containing the list of workspaces and total count.
   */
  async searchPublicWorkspacesByName(
    searchTerm: string,
    page: number,
    pageSize: number,
  ): Promise<{ workspaces: WithId<Workspace>[]; total: number }> {
    const collection = this.db.collection<Workspace>(Collections.WORKSPACE);
    const searchQuery = {
      workspaceType: WorkspaceType.PUBLIC,
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { "team.name": { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
      ],
    };

    const skip = (page - 1) * pageSize;
    const total = await collection.countDocuments(searchQuery);
    const workspaces = await collection
      .find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return { workspaces, total };
  }
}
