import { Injectable, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db } from "mongodb";
import { PromoCodeDto } from "@src/modules/common/models/promocode.model";

/**
 * Repository for handling promo code database operations
 */
@Injectable()
export class PromoCodeRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Create a new promo code from Stripe response
   */
  async createPromoCode(stripePromoCode: any): Promise<PromoCodeDto> {
    const promoCodeData = {
      code: stripePromoCode.code,
      stripePromoCodeId: stripePromoCode.id,
      createdAt: new Date(stripePromoCode.created * 1000),
      expiresAt: stripePromoCode.expires_at
        ? new Date(stripePromoCode.expires_at * 1000)
        : undefined,
      duration: stripePromoCode.coupon.duration,
      type: stripePromoCode.coupon.metadata.type,
      applicableProducts: stripePromoCode.coupon.metadata.applicable_products
        ? stripePromoCode.coupon.metadata.applicable_products.split(",")
        : [],
      value: parseInt(stripePromoCode.coupon.metadata.value),
      billingCycles: stripePromoCode.coupon.metadata.billing_cycle,
    };

    const result = await this.db
      .collection(Collections.PROMOCODES)
      .insertOne(promoCodeData);

    return {
      ...promoCodeData,
      _id: result.insertedId.toString(),
    } as PromoCodeDto;
  }

  /**
   * Find promo code by code
   */
  async findByCode(code: string): Promise<PromoCodeDto | null> {
    const result = await this.db
      .collection(Collections.PROMOCODES)
      .findOne({ code: code });

    if (!result) return null;

    return {
      ...result,
      _id: result._id.toString(),
    } as PromoCodeDto;
  }

  /**
   * Find promo code by Stripe promo code ID
   */
  async findByStripePromoCodeId(
    stripePromoCodeId: string,
  ): Promise<PromoCodeDto | null> {
    const result = await this.db
      .collection(Collections.PROMOCODES)
      .findOne({ stripePromoCodeId: stripePromoCodeId });

    if (!result) return null;

    return {
      ...result,
      _id: result._id.toString(),
    } as PromoCodeDto;
  }
}
