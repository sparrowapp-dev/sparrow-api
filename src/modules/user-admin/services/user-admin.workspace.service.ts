import { Injectable, NotFoundException } from "@nestjs/common";
import { AdminWorkspaceRepository } from "../repositories/user-admin.workspace.repository";
import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { WorkspaceRepository } from "@src/modules/workspace/repositories/workspace.repository";
import { ObjectId } from "mongodb";

@Injectable()
export class AdminWorkspaceService {
  constructor(
    private readonly workspaceRepo: AdminWorkspaceRepository,
    private readonly adminHubService: AdminHubsRepository,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async getPaginatedHubWorkspaces(
    hubId: string,
    page: number,
    limit: number,
    search: string,
    sort: { sortBy: string; sortOrder: "asc" | "desc" },
    workspaceType?: "PRIVATE" | "PUBLIC",
    userId?: string,
  ) {
    const skip = (page - 1) * limit;

    const query: any = { "team.id": hubId };

    const totalWorkspaceCount =
      await this.workspaceRepo.getTotalWorkspaceCount(query);

    if (search) {
      query.name = { $regex: new RegExp(search, "i") };
    }
    if (workspaceType) {
      query.workspaceType = workspaceType;
    }

    const sortConfig: Record<string, 1 | -1> = {
      [sort.sortBy]: sort.sortOrder === "asc" ? 1 : -1,
    };
    if (userId) {
      const userObjectId = new ObjectId(userId);
      const userIdString = userId.toString();
      query.users = {
        $elemMatch: {
          $or: [{ id: userObjectId }, { id: userIdString }],
        },
      };
    }

    const { total, rawData } = await this.workspaceRepo.findPaginated(
      query,
      sortConfig,
      skip,
      limit,
    );

    const hub = await this.adminHubService.findHubById(hubId);
    if (!hub) throw new NotFoundException("Hub not found");

    const workspaces = rawData.map((ws) => ({
      id: ws._id,
      name: ws.name,
      visibility: ws.workspaceType,
      contributors: ws.users?.length || 0,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
      collections: ws.collection?.length || 0,
    }));

    return {
      hubName: hub.name,
      isNewHub: totalWorkspaceCount === 0,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalCount: total,
      limit,
      hubs: workspaces,
    };
  }
  async getPaginatedWorkspaceDetails(
    workspaceId: string,
    tab: string,
    page: number,
    limit: number,
    search: string,
    resource: "collections" | "testflows" | "environments" | "all" = "all",
    sort: { sortBy: string; sortOrder: "asc" | "desc" },
  ) {
    const workspace = await this.workspaceRepository.get(workspaceId);

    if (tab === "resources") {
      if (resource === "all") {
        const allResources = [];

        //  Collections
        const collectionIds =
          workspace?.collection?.map((c) => new ObjectId(c?.id)) || [];
        if (collectionIds.length > 0) {
          const { collections } =
            await this.workspaceRepo.getFilteredCollectionsByIds({
              ids: collectionIds.map((id) => id.toString()),
              search,
              sort: sort,
            });

          const mappedCollections = collections.map((item: any) => ({
            resourceType: "collections",
            keyStats: item?.items?.length,
            name: item?.name,
            updatedAt: item?.updatedAt,
            createdBy: item?.createdBy,
            updatedBy: item?.updatedBy,
            id: item?.id,
          }));

          allResources.push(...mappedCollections);
        }

        //  Testflows
        const testflowsId =
          workspace?.testflows?.map((c) => new ObjectId(c?.id)) || [];
        if (testflowsId.length > 0) {
          const { testflows } =
            await this.workspaceRepo.getFilteredTestFlowsById({
              ids: testflowsId.map((id) => id.toString()),
              search,
              sort: sort,
            });

          const mappedTestflows = testflows.map((item) => ({
            resourceType: "testflows",
            keyStats: item?.nodes?.length,
            name: item?.name,
            updatedAt: item?.updatedAt,
            createdBy: item?.createdByUser?.[0]?.name,
            updatedBy: item?.updatedByUser?.[0]?.name,
            id: item._id,
          }));

          allResources.push(...mappedTestflows);
        }

        // Environments
        const environmentsId =
          workspace?.environments?.map((c) => new ObjectId(c?.id)) || [];
        if (environmentsId.length > 0) {
          const { environments } =
            await this.workspaceRepo.getFilteredEnvironmentsById({
              ids: environmentsId.map((id) => id.toString()),
              search,
              sort: sort,
            });

          const mappedEnvironments = environments.map((item: any) => ({
            resourceType: "environments",
            keyStats: item?.variable?.length,
            name: item?.name,
            updatedAt: item?.updatedAt,
            createdBy: item?.createdBy,
            updatedBy: item?.updatedBy,
            id: item?.id,
          }));

          allResources.push(...mappedEnvironments);
        }

        //  Manual Sort
        if (sort.sortBy === "resources") {
          allResources.sort((a, b) => {
            const comparison = a.name.localeCompare(b.name);
            return sort.sortOrder === "asc" ? comparison : -comparison;
          });
        } else if (sort.sortBy === "createdBy") {
          allResources.sort((a, b) => {
            const aBy = a.createdBy?.toLowerCase?.() || "";
            const bBy = b.createdBy?.toLowerCase?.() || "";
            const comparison = aBy.localeCompare(bBy);
            return sort.sortOrder === "asc" ? comparison : -comparison;
          });
        } else {
          allResources.sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return sort.sortOrder === "asc" ? dateA - dateB : dateB - dateA;
          });
        }

        //  Manual Pagination
        const totalCount = allResources.length;
        const start = (page - 1) * limit;
        const paginatedResources = allResources.slice(start, start + limit);

        return { resources: paginatedResources, totalCount };
      }

      // Fetch individual resource types (collections / testflows / environments)
      if (resource === "collections") {
        const collectionIds =
          workspace?.collection?.map((c) => new ObjectId(c?.id)) || [];
        if (collectionIds.length > 0) {
          const { collections, totalCount } =
            await this.workspaceRepo.getFilteredCollectionsByIds({
              ids: collectionIds.map((id) => id.toString()),
              search,
              sort: sort,
              page,
              limit,
            });

          const mappedCollections = collections.map((item: any) => ({
            resourceType: "collections",
            keyStats: item?.items?.length,
            name: item?.name,
            updatedAt: item?.updatedAt,
            createdBy: item?.createdBy,
            updatedBy: item?.updatedBy,
            id: item?.id,
          }));

          return { resources: mappedCollections, totalCount };
        }
      }

      if (resource === "testflows") {
        const testflowsId =
          workspace?.testflows?.map((c) => new ObjectId(c?.id)) || [];
        if (testflowsId.length > 0) {
          const { testflows, totalCount } =
            await this.workspaceRepo.getFilteredTestFlowsById({
              ids: testflowsId.map((id) => id.toString()),
              search,
              sort: sort,
              page,
              limit,
            });

          const mappedTestflows = testflows.map((item) => ({
            resourceType: "testflows",
            keyStats: item?.nodes?.length,
            name: item?.name,
            updatedAt: item?.updatedAt,
            updatedBy: item?.updatedByUser?.[0]?.name,
            createdBy: item?.createdBy,
            id: item?.id,
          }));

          return { resources: mappedTestflows, totalCount };
        }
      }

      if (resource === "environments") {
        const environmentsId =
          workspace?.environments?.map((c) => new ObjectId(c?.id)) || [];
        if (environmentsId.length > 0) {
          const { environments, totalCount } =
            await this.workspaceRepo.getFilteredEnvironmentsById({
              ids: environmentsId.map((id) => id.toString()),
              search,
              sort: sort,
              page,
              limit,
            });

          const mappedEnvironments = environments.map((item: any) => ({
            resourceType: "environments",
            keyStats: item?.variable?.length,
            name: item?.name,
            updatedAt: item?.updatedAt,
            createdBy: item?.createdBy,
            updatedBy: item?.updatedBy,
            id: item?.id,
          }));

          return { resources: mappedEnvironments, totalCount };
        }
      }

      return { resources: [], totalCount: 0 };
    } else {
      const filteredUsers = workspace?.users?.filter((item) =>
        item?.name?.toLowerCase().includes(search),
      );

      const totalCount = filteredUsers?.length || 0;

      // Paginate
      const startIndex = (page - 1) * limit;
      const paginatedUsers = filteredUsers?.slice(
        startIndex,
        startIndex + limit,
      );

      const users = paginatedUsers?.map((item) => ({
        user: item?.name,
        _id: item?.id,
        role: item?.role,
        email: item?.email,
      }));

      const data = { users, totalCount };
      return data;
    }
  }
  async getWorkspaceSummary(workspaceId: string, hubId: string) {
    const workspace = await this.workspaceRepository.get(workspaceId);
    const hub = await this.adminHubService.findHubById(hubId);
    const workspace_summary = {
      totalCollections: workspace?.collection?.length ?? 0,
      totalContributors:
        workspace?.users?.filter((user) => user.role !== "viewer")?.length ?? 0,
      totalTestFLows: workspace?.testflows?.length ?? 0,
      totalEnvironments: workspace?.environments?.length ?? 0,
      title: workspace?.name,
      description: workspace?.description,
      updatedAt: workspace.updatedAt,
      updatedBy: workspace?.users?.find(
        (user) => user.id?.toString() === workspace?.updatedBy?.toString(),
      )?.name,
      WorkspaceType: workspace?.workspaceType,
      hubName: hub?.name,
    };
    return workspace_summary;
  }
}
