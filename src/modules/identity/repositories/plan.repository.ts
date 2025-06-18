import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Db, InsertOneResult, ObjectId, WithId } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { CreateOrUpdatePlanDto } from "../payloads/plan.payload";
import { Plan } from "@src/modules/common/models/plan.model";

/**
 * Plan Repository
 */
@Injectable()
export class PlanRepository {
  constructor(
    @Inject("DATABASE_CONNECTION")
    private db: Db,
  ) {}

  /**
   * Creates a new plan in the database
   * @param {CreateOrUpdatePlanDto} planData
   * @returns {Promise<InsertOneWriteOpResult<Plan>>} result of the insert operation
   */
  async create(
    planData: CreateOrUpdatePlanDto,
  ): Promise<InsertOneResult<Plan>> {
    const params = {
      createdBy: "system",
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: "system",
    };

    const createdPlan = await this.db
      .collection<Plan>(Collections.PLAN)
      .insertOne({
        ...planData,
        ...params,
      });
    return createdPlan;
  }

  /**
   * Fetches a plan from database by UUID
   * @param {string} id
   * @returns {Promise<Plan>} queried plan data
   */
  async get(id: string): Promise<WithId<Plan>> {
    const _id = new ObjectId(id);
    const plan = await this.db
      .collection<Plan>(Collections.PLAN)
      .findOne({ _id });
    if (!plan) {
      throw new NotFoundException("Plan not found.");
    }
    return plan;
  }

  /**
   * Fetches plans from database by UUID
   * @param {string} id
   * @returns {Promise<Plan>} queried plan data
   */
  async getPlans(): Promise<WithId<Plan>[]> {
    const plans = await this.db
      .collection<Plan>(Collections.PLAN)
      .find()
      .toArray();
    return plans;
  }

  async getPlansByIds(ids: string[]): Promise<WithId<Plan>[]> {
    const objectIds = ids.map((id) => new ObjectId(id));
    const plans = await this.db
      .collection<Plan>(Collections.PLAN)
      .find({ _id: { $in: objectIds } })
      .toArray();
    if (!plans || plans.length === 0) {
      throw new NotFoundException("No matching plans found.");
    }
    return plans;
  }
}
