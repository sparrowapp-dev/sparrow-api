import { Injectable } from "@nestjs/common";
import { PromoCodeRepository } from "../repositories/promocode.repository";
import { PromoCodeDto } from "@src/modules/common/models/promocode.model";

/**
 * Service for managing promo codes
 */
@Injectable()
export class PromoCodeService {
  constructor(private readonly promoCodeRepository: PromoCodeRepository) {}

  /**
   * Create a new promo code and save to database from Stripe response
   */
  async createPromoCode(stripePromoCode: any): Promise<PromoCodeDto> {
    return await this.promoCodeRepository.createPromoCode(stripePromoCode);
  }

  /**
   * Validate promo code for a specific price/plan
   */
  async validatePromoCode(
    code: string,
    priceId: string,
    userEmail?: string,
  ): Promise<{
    error: boolean;
    message: string;
    type?: string;
    value?: number;
    promo_id?: string;
    billing_cycles?: string;
  }> {
    // Find promo code in database
    const promoCode = await this.promoCodeRepository.findByCode(code);

    if (!promoCode) {
      return {
        error: true,
        message: "Invalid promo code. Please enter a valid promo code.",
      };
    }

    if (userEmail && promoCode?.allowedUsers?.length > 0) {
      const lowercasedEmail = userEmail?.toLowerCase();
      const lowercasedAllowedUsers = promoCode?.allowedUsers?.map((email) =>
        email.toLowerCase(),
      );

      if (!lowercasedAllowedUsers.includes(lowercasedEmail)) {
        return {
          error: true,
          message: "Invalid promo code. Please enter a valid promo code.",
        };
      }
    }

    // Check if promo code has expired
    const now = new Date();
    if (promoCode.expiresAt && now > promoCode.expiresAt) {
      return {
        error: true,
        message: "This promo code has expired.",
      };
    }

    // Check if promo code is applicable for the selected plan
    if (
      promoCode.applicableProducts &&
      promoCode.applicableProducts.length > 0 &&
      !promoCode.applicableProducts.includes(priceId)
    ) {
      return {
        error: true,
        message: "This promo code is not applicable for your selected plan.",
      };
    }

    // Generate success message based on type and billing cycles
    let successMessage = "";
    const billingCycleText = promoCode.billingCycles
      ? promoCode.billingCycles === "1"
        ? `first month`
        : `first ${promoCode.billingCycles} months`
      : "first month";

    if (promoCode.type === "percentage") {
      successMessage = `Promo applied successfully. You'll get ${promoCode.value}% off for the ${billingCycleText} after your trial ends.`;
    } else if (promoCode.type === "amount") {
      successMessage = `Promo applied successfully. You'll get $${promoCode.value} off for the ${billingCycleText} after your trial ends.`;
    }

    return {
      error: false,
      message: successMessage,
      type: promoCode.type,
      value: promoCode.value,
      billing_cycles: promoCode.billingCycles,
      promo_id: promoCode.stripePromoCodeId,
    };
  }

  /**
   * Find promo code by Stripe promo code ID
   */
  async findByStripePromoCodeId(
    stripePromoCodeId: string,
  ): Promise<PromoCodeDto | null> {
    return await this.promoCodeRepository.findByStripePromoCodeId(
      stripePromoCodeId,
    );
  }
}
