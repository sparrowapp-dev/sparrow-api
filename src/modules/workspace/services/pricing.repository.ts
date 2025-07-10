import { Injectable } from "@nestjs/common";
import { InsertOneResult, WithId } from "mongodb";

import { PricingRepository } from "../repositories/pricing.repository";
import { Pricing } from "@src/modules/common/models/pricing.model";

/**
 * Pricing Service - Service responsible for handling operations related to pricing.
 */
@Injectable()
export class PricingService {
  /**
   * Constructor to initialize Pricing Service with required dependencies.
   */
  constructor(private readonly pricingRepository: PricingRepository) {}

  /**
   * Retrieves pricing data from DB.
   */
  async getpricingDetails(): Promise<WithId<Pricing> | null> {
    const data = await this.pricingRepository.getLatestPricing();
    return data;
  }
}
