import { Injectable } from "@nestjs/common";
import { InsertOneResult, WithId } from "mongodb";
// ---- Service
import { ContextService } from "@src/modules/common/services/context.service";

// ---- Payload & Models
import { AddUpdateDto } from "../payloads/updates.payload";
import { Updates } from "@src/modules/common/models/updates.model";

// ---- Repository
import { UpdatesRepository } from "../repositories/updates.repository";

/**
 * Updates Service - Service responsible for handling operations related to updates.
 */
@Injectable()
export class UpdatesService {
  /**
   * Constructor to initialize UpdatesService with required dependencies.
   * @param contextService - Injected ContextService for accessing user context.
   * @param updatesRepository - Injected UpdatesRepository for database operations.
   */
  constructor(
    private readonly contextService: ContextService,
    private readonly updatesRepository: UpdatesRepository,
  ) {}

  /**
   * Adds a new update to the database.
   * @param update - The update object to be added.
   * @returns A promise resolving to the result of the database insertion.
   */
  async addUpdate(update: AddUpdateDto): Promise<InsertOneResult<Updates>> {
    const modifiedUpdate = {
      ...update,
      createdAt: new Date(),
      createdBy: this.contextService.get("user")._id,
      detailsUpdatedBy: this.contextService.get("user").name,
    };
    const response = await this.updatesRepository.addUpdate(modifiedUpdate);
    return response;
  }

  /**
   * Retrieves updates for a specific workspace in a paginated manner.
   * @param workspaceId - The ID of the workspace to fetch updates for.
   * @param page - The page number of updates to fetch.
   * @returns A promise resolving to an object containing the page number and array of updates.
   */
  async findUpdatesByWorkspace(
    workspaceId: string,
    page: string,
  ): Promise<{ pageNumber: number; updates: WithId<Updates>[] }> {
    const pageNumber = parseInt(page, 10) || 1;
    const limit = 20;
    const skip = (pageNumber - 1) * limit;
    const updates = await this.updatesRepository.getPaginatedUpdates(
      workspaceId,
      skip,
      limit,
    );
    return {
      pageNumber,
      updates,
    };
  }
}
