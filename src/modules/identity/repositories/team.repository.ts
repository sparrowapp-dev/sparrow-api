import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  Db,
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";

import {
  CreateOrUpdateTeamDto,
  TeamDto,
  UpdateTeamDto,
} from "../payloads/team.payload";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { User } from "@src/modules/common/models/user.model";
import { Team } from "@src/modules/common/models/team.model";
import { WorkspaceDto } from "@src/modules/common/models/workspace.model";
import { TeamRole } from "@src/modules/common/enum/roles.enum";
import { PlanDto } from "../payloads/plan.payload";
import { DecodedUserObject } from "@src/types/fastify";
import { TeamDtoWithTimeStamps } from "../payloads/team.payload";

/**
 * Team Service
 */
@Injectable()
export class TeamRepository {
  constructor(
    @Inject("DATABASE_CONNECTION")
    private db: Db,
  ) {}

  /**
   * Creates a new team in the database
   * @param {CreateOrUpdateTeamDto} teamData
   * @returns {Promise<InsertOneWriteOpResult<Team>>} result of the insert operation
   */
  async create(
    teamData: CreateOrUpdateTeamDto,
    plan: PlanDto,
    user: DecodedUserObject,
  ): Promise<InsertOneResult<Team>> {
    const params = {
      users: [
        {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: TeamRole.OWNER,
        },
      ],
      workspaces: [] as WorkspaceDto[],
      owner: user._id.toString(),
      admins: [] as string[],
      createdBy: user._id.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: user._id.toString(),
    };

    const createdTeam = await this.db
      .collection<Team>(Collections.TEAM)
      .insertOne({
        ...teamData,
        ...params,
        plan,
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
   * Fetches teams from database by UUID
   * @param {string[]} teamIds
   * @returns {Promise<Team>} queried team data
   */
  async getTeamsByIds(teamIds: string[]): Promise<WithId<Team>[]> {
    const teams = await this.db.collection<Team>(Collections.TEAM)
    .find({ _id: { $in: teamIds.map(id => new ObjectId(id)) } })
      .toArray();
    if (!teams) {
      throw new BadRequestException(
        "The teams with that ids could not be found.",
      );
    }
    return teams;
  }

  /**
   * Fetches a team from database by UUID
   * @param {string} id
   * @returns {Promise<Team>} queried team data
   */
  async getTeams(): Promise<WithId<Team>[]> {
    const teams = await this.db
      .collection<Team>(Collections.TEAM)
      .find()
      .toArray();
    return teams;
  }

  /**
   * Updates a team name
   * @param {string} id
   * @returns {Promise<ITeam>} mutated team data
   */
  async update(
    id: string,
    payload: Partial<UpdateTeamDto>,
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
    updateParams: Partial<TeamDtoWithTimeStamps>,
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

  async isTeamNameAvailable(name: string): Promise<boolean> {
    const team = await this.db
      .collection<Team>(Collections.TEAM)
      .findOne({ name: name });

    return !team; // true if not found (available), false if found (already exists)
  }

  async existingHubUrls(regexPattern: string) {
    // Fetch all matching URLs (e.g., https://techdome.sparrowhub.net, https://techdome1.sparrowhub.net, etc.)
    const existingTeams = await this.db
      .collection<Team>(Collections.TEAM)
      .find({ hubUrl: { $regex: regexPattern, $options: "i" } })
      .project({ hubUrl: 1 }) // only fetch hubUrl field
      .toArray();
    return existingTeams;
  }

  async doesHubUrlExist(hubUrl: string): Promise<boolean> {
    const team = await this.db
      .collection<Team>(Collections.TEAM)
      .findOne({ hubUrl: hubUrl });
    return !!team;
  }

  /**
   * Update isHubTrialExhausted and plan object for a team
   */
  async updateTrialAndPlan(
    teamId: string,
    isHubTrialExhausted: boolean,
    plan: any,
  ): Promise<UpdateResult<Team>> {
    const _id = new ObjectId(teamId);
    return await this.db
      .collection<Team>(Collections.TEAM)
      .updateOne({ _id }, { $set: { isHubTrialExhausted, plan } });
  }
}
