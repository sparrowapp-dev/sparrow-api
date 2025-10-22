import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Team, TeamDto } from "@src/modules/common/models/team.model";
import { Db } from "mongodb";
import { ObjectId, WithId } from "mongodb";

/**
 * Repository for handling promo code database operations
 */
@Injectable()
export class DownGradeTeamRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async findTeamByTeamId(id: ObjectId): Promise<WithId<Team>> {
    const teamData = await this.db
      .collection<Team>(Collections.TEAM)
      .findOne({ _id: id });
    return teamData;
  }

  async updateTeamById(
    id: ObjectId,
    updateParams: Partial<any>,
  ): Promise<WithId<Team>> {
    const updatedTeamParams = {
      $set: updateParams,
    };
    const responseData = await this.db
      .collection<Team>(Collections.TEAM)
      .findOneAndUpdate({ _id: id }, updatedTeamParams);
    return responseData.value;
  }
}
