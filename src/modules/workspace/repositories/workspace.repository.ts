import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  Db,
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";
import { Workspace } from "../../common/models/workspace.model";
import { Collections } from "../../common/enum/database.collection.enum";
import {
  UpdateWorkspaceDto,
  WorkspaceDtoForIdDocument,
} from "../payloads/workspace.payload";
import { ContextService } from "../../common/services/context.service";
import { CollectionDto } from "@src/modules/common/models/collection.model";
import { EnvironmentDto } from "@src/modules/common/models/environment.model";
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
    updatedWorkspace: WorkspaceDtoForIdDocument,
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
    return await this.db
      .collection(Collections.WORKSPACE)
      .updateOne(
        { _id },
        { $push: { collection: { id: collection.id, name: collection.name } } },
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
}
