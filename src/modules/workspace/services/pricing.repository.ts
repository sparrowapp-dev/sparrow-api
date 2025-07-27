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

  /**
   * Validates if the provided price IDs exist in the pricing collection
   */
  async validatePriceIds(
    priceIds: string[],
  ): Promise<{ valid: boolean; invalidPriceIds: string[] }> {
    const pricingData = await this.getpricingDetails();

    if (!pricingData) {
      return { valid: false, invalidPriceIds: priceIds };
    }

    // Extract all valid price IDs from all plans and billing intervals
    const validPriceIds: string[] = [];
    pricingData.plans.forEach((plan) => {
      plan.billing.forEach((billing) => {
        if (billing.providers.stripe) {
          validPriceIds.push(billing.providers.stripe);
        }
      });
    });

    // Check which price IDs are invalid
    const invalidPriceIds = priceIds.filter(
      (priceId) => !validPriceIds.includes(priceId),
    );

    return {
      valid: invalidPriceIds.length === 0,
      invalidPriceIds,
    };
  }

  /**
   * Gets the price for a specific price ID
   */
  async getPriceByPriceId(priceId: string): Promise<number | null> {
    const pricingData = await this.getpricingDetails();

    if (!pricingData) {
      return null;
    }

    // Find the price for the given price ID
    for (const plan of pricingData.plans) {
      for (const billing of plan.billing) {
        if (billing.providers.stripe === priceId) {
          return billing.price;
        }
      }
    }

    return null;
  }

  /**
   * Validates if a discount amount is not greater than any of the applicable product prices
   */
  async validateDiscountAmount(
    amount: number,
    applicablePriceIds: string[],
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (applicablePriceIds.length === 0) {
      // If no specific products, we should check against all prices
      const pricingData = await this.getpricingDetails();
      if (!pricingData) {
        errors.push(
          "Unable to validate discount amount: pricing data not found",
        );
        return { valid: false, errors };
      }

      const minPrice = Math.min(
        ...pricingData.plans.flatMap((plan) =>
          plan.billing.map((billing) => billing.price),
        ),
      );

      if (amount >= minPrice) {
        errors.push(
          `Discount amount ($${amount}) cannot be equal to or greater than the minimum plan price ($${minPrice})`,
        );
      }
    } else {
      // Check against specific applicable products
      for (const priceId of applicablePriceIds) {
        const price = await this.getPriceByPriceId(priceId);
        if (price === null) {
          errors.push(`Price not found for price ID: ${priceId}`);
        } else if (amount > price) {
          errors.push(
            `Discount amount ($${amount}) cannot be greater than the price ($${price}) for price ID: ${priceId}`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
