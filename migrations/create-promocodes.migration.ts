import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db } from "mongodb";

@Injectable()
export class CreatePromocodesMigration implements OnModuleInit {
  private hasRun = false;
  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db, // Inject the MongoDB connection
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      if (this.hasRun) {
        // Check if migration has already run
        return;
      }

      const promocodesCollection = this.db.collection(Collections.PROMOCODES);

      // Check if promo code already exists
      const existingPromoCode = await promocodesCollection.findOne({
        code: "TEST20",
      });

      if (!existingPromoCode) {
        const promoCode = {
          code: "TEST20",
          stripePromoCodeId: "promo_1Rog3FFLRwufXqZCWrUW1Np1",
          createdAt: new Date("2025-07-25T07:28:21.000+00:00"),
          expiresAt: new Date("2026-08-31T23:59:59.000+00:00"),
          duration: "repeating",
          type: "percentage",
          applicableProducts: ["price_1RZaD7FLRwufXqZCEtDiMO02"],
          value: 20,
          billingCycles: "1",
          allowedUsers: [] as string[],
        };

        await promocodesCollection.insertOne(promoCode);
        console.log("\x1b[36mPromo code created successfully.\x1b[0m");
      } else {
        console.log("\x1b[33mPromo code already exists. Skipping.\x1b[0m");
      }

      this.hasRun = true; // Set flag after successful execution
    } catch (error) {
      console.error("Error during promo codes migration:", error);
    }
  }
}
