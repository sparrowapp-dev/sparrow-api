import { Inject, Injectable } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { Team } from "@src/modules/common/models/team.model";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
/**
 * Permission Repository
 */
@Injectable()
export class PermissionRepository {
  constructor(
    @Inject("DATABASE_CONNECTION")
    private db: Db,
  ) {}

  async setAdminPermissionForOwner(_id: ObjectId) {
    return this.db.collection<Team>(Collections.TEAM).findOne(
      { _id },
      {
        projection: {
          owners: 1,
        },
      },
    );
  }
}
