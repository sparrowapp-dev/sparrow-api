import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  Db,
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";
import { ContextService } from "@src/modules/common/services/context.service";
import { CreateOrUpdateTeamDto, TeamDto } from "../payloads/team.payload";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { User } from "@src/modules/common/models/user.model";
import { Team } from "@src/modules/common/models/team.model";
import { WorkspaceDto } from "@src/modules/common/models/workspace.model";
import { TeamRole } from "@src/modules/common/enum/roles.enum";

/**
 * Team Service
 */
@Injectable()
export class TeamRepository {
  constructor(
    @Inject("DATABASE_CONNECTION")
    private db: Db,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Creates a new team in the database
   * @param {CreateOrUpdateTeamDto} teamData
   * @returns {Promise<InsertOneWriteOpResult<Team>>} result of the insert operation
   */
  async create(
    teamData: CreateOrUpdateTeamDto,
  ): Promise<InsertOneResult<Team>> {
    const user = this.contextService.get("user");
    const exists = await this.doesTeamExistsForUser(user._id, teamData.name);
    if (exists) {
      throw new BadRequestException("The Team with that name already exists.");
    }
    const params = {
      users: [
        {
          id: user._id,
          email: user.email,
          name: user.name,
          role: TeamRole.OWNER,
        },
      ],
      workspaces: [] as WorkspaceDto[],
      owner: user._id.toString(),
      admins: [] as string[],
      createdBy: user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: user._id,
    };

    const createdTeam = await this.db
      .collection<Team>(Collections.TEAM)
      .insertOne({
        ...teamData,
        ...params,
      });
    return createdTeam;
  }

  /**
   * Fetches a team from database by UUID
   * @param {string} id
   * @returns {Promise<Team>} queried team data
   */
  async get(id: string): Promise<WithId<Team>> {
    const _id = new ObjectId(id);
    const team = await this.db
      .collection<Team>(Collections.TEAM)
      .findOne({ _id });
    if (!team) {
      throw new BadRequestException(
        "The Team with that id could not be found.",
      );
    }
    return team;
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
    const _id = new ObjectId(id);
    const updatedTeam = await this.db
      .collection<Team>(Collections.TEAM)
      .updateOne({ _id }, { $set: payload });
    if (!updatedTeam.matchedCount) {
      throw new BadRequestException(
        "The teams with that id does not exist in the system.",
      );
    }
    return updatedTeam;
  }

  /**
   * Delete a team from the database by UUID
   * @param {string} id
   * @returns {Promise<DeleteWriteOpResultObject>} result of the delete operation
   */
  async delete(id: string): Promise<DeleteResult> {
    const _id = new ObjectId(id);
    const deletedTeam = await this.db
      .collection<Team>(Collections.TEAM)
      .deleteOne({ _id });
    if (!deletedTeam) {
      throw new BadRequestException(
        "The Team with that id could not be found.",
      );
    }
    return deletedTeam;
  }

  async findTeamByTeamId(id: ObjectId): Promise<WithId<Team>> {
    const teamData = await this.db
      .collection<Team>(Collections.TEAM)
      .findOne({ _id: id });
    return teamData;
  }

  async updateTeamById(
    id: ObjectId,
    updateParams: TeamDto,
  ): Promise<WithId<Team>> {
    const updatedTeamParams = {
      $set: updateParams,
    };
    const responseData = await this.db
      .collection<Team>(Collections.TEAM)
      .findOneAndUpdate({ _id: id }, updatedTeamParams);
    return responseData.value;
  }

  private async doesTeamExistsForUser(
    userId: ObjectId,
    teamName: string,
  ): Promise<WithId<User>> {
    return await this.db.collection<User>(Collections.USER).findOne({
      _id: userId,
      teams: {
        $elemMatch: {
          name: teamName,
        },
      },
    });
  }
}
