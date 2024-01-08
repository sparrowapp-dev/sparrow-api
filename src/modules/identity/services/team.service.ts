import { Injectable } from "@nestjs/common";
import { CreateOrUpdateTeamDto } from "../payloads/team.payload";
import { TeamRepository } from "../repositories/team.repository";
import { DeleteResult, InsertOneResult, UpdateResult, WithId } from "mongodb";
import { Team } from "@src/modules/common/models/team.model";

/**
 * Team Service
 */
@Injectable()
export class TeamService {
  constructor(private readonly teamRepository: TeamRepository) {}

  /**
   * Creates a new team in the database
   * @param {CreateOrUpdateTeamDto} teamData
   * @returns {Promise<InsertOneWriteOpResult<Team>>} result of the insert operation
   */
  async create(
    teamData: CreateOrUpdateTeamDto,
  ): Promise<InsertOneResult<Team>> {
    const data = await this.teamRepository.create(teamData);
    return data;
  }

  /**
   * Fetches a team from database by UUID
   * @param {string} id
   * @returns {Promise<Team>} queried team data
   */
  async get(id: string): Promise<WithId<Team>> {
    const data = await this.teamRepository.get(id);
    return data;
  }

  /**
   * Updates a team name
   * @param {string} id
   * @returns {Promise<ITeam>} mutated team data
   */
  async update(
    id: string,
    payload: CreateOrUpdateTeamDto,
  ): Promise<UpdateResult<Team>> {
    const data = await this.teamRepository.update(id, payload);
    return data;
  }

  /**
   * Delete a team from the database by UUID
   * @param {string} id
   * @returns {Promise<DeleteWriteOpResultObject>} result of the delete operation
   */
  async delete(id: string): Promise<DeleteResult> {
    const data = await this.teamRepository.delete(id);
    return data;
  }
}
