import { Injectable } from "@nestjs/common";

import { InsertOneResult, WithId } from "mongodb";
import { CreateOrUpdatePlanDto } from "../payloads/plan.payload";
import { Plan } from "@src/modules/common/models/plan.model";
import { PlanRepository } from "../repositories/plan.repository";

/**
 * Plan Service
 */
@Injectable()
export class PlanService {
  constructor(private readonly planRepository: PlanRepository) {}

  /**
   * Creates a new plan in the database
   * @param {CreateOrUpdatePlanDto} planData
   * @returns  result of the insert operation
   */
  async create(
    planData: CreateOrUpdatePlanDto,
  ): Promise<InsertOneResult<Plan>> {
    const createdPlan = await this.planRepository.create(planData);
    return createdPlan;
  }

  /**
   * Fetches a plan from database by UUID
   * @param  id
   * @returns queried plan data
   */
  async get(id: string): Promise<WithId<Plan>> {
    const data = await this.planRepository.get(id);
    return data;
  }

  /**
   * Fetches a plan list from database by UUID
   * @returns queried plan data
   */
  async getAllPlans(): Promise<WithId<Plan>[]> {
    const data = await this.planRepository.getPlans();
    return data;
  }

  /**
   * Fetches a plans from database by UUID
   * @param  ids[]
   * @returns queried plan data
   */
  async getPlansByIds(ids: string[]): Promise<WithId<Plan>[]> {
    const data = await this.planRepository.getPlansByIds(ids);
    return data;
  }
}
