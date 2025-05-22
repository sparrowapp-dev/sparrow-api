import { Injectable, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Collection } from "@src/modules/common/models/collection.model";
import { Environment } from "@src/modules/common/models/environment.model";
import { Db, ObjectId } from "mongodb";

@Injectable()
export class AdminWorkspaceRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async findWorkspaceById(workspaceId: string) {
    const workspaceObjectId = new ObjectId(workspaceId);
    return this.db.collection("workspace").findOne({ _id: workspaceObjectId });
  }

  async findPaginated(query: any, sort: any, skip: number, limit: number) {
    const collection = this.db.collection("workspace");

    const total = await collection.countDocuments(query);
    const rawData = await collection
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return { total, rawData };
  }

  async getTotalWorkspaceCount(query: any): Promise<number> {
    return await this.db.collection("workspace").countDocuments(query);
  }
  async getFilteredCollectionsByIds({
    ids = [],
    search = "",
    page,
    limit,
    sort = { sortBy: "updatedAt", sortOrder: "desc" },
  }: {
    ids?: string[];
    search?: string;
    page?: number;
    limit?: number;
    sort?: { sortBy: string; sortOrder: "asc" | "desc" };
  }): Promise<{ collections: Collection[]; totalCount: number }> {
    const objectIds = ids.map((id) => new ObjectId(id));
    const searchRegex = new RegExp(search, "i");

    const allowedSortFields = ["name", "createdBy", "updatedAt"];
    const sortBy = allowedSortFields.includes(sort.sortBy)
      ? sort.sortBy
      : "updatedAt";
    const sortOrder = sort.sortOrder === "asc" ? 1 : -1;

    const query = {
      _id: { $in: objectIds },
      name: { $regex: searchRegex },
    };

    const collectionRef = this.db.collection<Collection>(
      Collections.COLLECTION,
    );

    const totalCount = await collectionRef.countDocuments(query);

    let cursor = collectionRef.find(query).sort({ [sortBy]: sortOrder });

    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      cursor = cursor.skip(skip).limit(limit);
    }

    const collections = await cursor.toArray();

    return { collections, totalCount };
  }

  async getFilteredTestFlowsById({
    ids = [],
    search = "",
    page,
    limit,
    sort = { sortBy: "updatedAt", sortOrder: "desc" },
  }: {
    ids?: string[];
    search?: string;
    page?: number;
    limit?: number;
    sort?: { sortBy: string; sortOrder: "asc" | "desc" };
  }): Promise<{ testflows: any[]; totalCount: number }> {
    const objectIds = ids.map((id) => new ObjectId(id));
    const allowedSortFields = ["name", "createdBy", "updatedAt"];
    const sortBy = allowedSortFields.includes(sort.sortBy)
      ? sort.sortBy
      : "updatedAt";
    const sortOrder = sort.sortOrder === "asc" ? 1 : -1;

    const matchStage = {
      _id: { $in: objectIds },
      name: { $regex: new RegExp(search, "i") },
    };

    const collection = this.db.collection<any>(Collections.TESTFLOW);

    // Fetch total count
    const totalCount = await collection.countDocuments(matchStage);

    // Build aggregation pipeline
    const pipeline: any[] = [
      { $match: matchStage },
      { $addFields: { createdByObjId: { $toObjectId: "$createdBy" } } },
      { $sort: { [sortBy]: sortOrder } },
    ];

    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      pipeline.push({ $skip: skip }, { $limit: limit });
    }

    pipeline.push(
      {
        $lookup: {
          from: "user",
          localField: "createdByObjId",
          foreignField: "_id",
          as: "createdByUser",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          updatedAt: 1,
          updatedBy: 1,
          nodes: 1,
          createdByUser: 1,
        },
      },
    );

    const testflows = await collection.aggregate(pipeline).toArray();

    return { testflows, totalCount };
  }

  async getFilteredEnvironmentsById({
    ids = [],
    search = "",
    page,
    limit,
    sort = { sortBy: "updatedAt", sortOrder: "desc" },
  }: {
    ids?: string[];
    search?: string;
    page?: number;
    limit?: number;
    sort?: { sortBy: string; sortOrder: "asc" | "desc" };
  }): Promise<{ environments: Environment[]; totalCount: number }> {
    const objectIds = ids.map((id) => new ObjectId(id));
    const searchRegex = new RegExp(search, "i");

    const allowedSortFields = ["name", "createdBy", "updatedAt"];
    const sortBy = allowedSortFields.includes(sort.sortBy)
      ? sort.sortBy
      : "updatedAt";
    const sortOrder = sort.sortOrder === "asc" ? 1 : -1;

    const query = {
      _id: { $in: objectIds },
      name: { $regex: searchRegex },
    };

    const collection = this.db.collection<Environment>(Collections.ENVIRONMENT);

    const totalCount = await collection.countDocuments(query);

    let cursor = collection.find(query).sort({ [sortBy]: sortOrder });

    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      cursor = cursor.skip(skip).limit(limit);
    }

    const environments = await cursor.toArray();

    return { environments, totalCount };
  }
}
