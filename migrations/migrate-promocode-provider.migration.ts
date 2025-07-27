import { Db, MongoClient } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";

/**
 * Migration to convert stripePromoCodeId to promoCodeProvider array structure
 * This migration updates existing promo codes from the old structure:
 * { stripePromoCodeId: "promo_123" }
 * 
 * To the new structure:
 * { promoCodeProvider: [{ id: "promo_123", provider: "stripe" }] }
 */
export class MigratePromoCodeProviderMigration {
  constructor(private readonly db: Db) {}

  async up(): Promise<void> {
    console.log("Starting promo code provider migration...");

    const collection = this.db.collection(Collections.PROMOCODES);

    // Find all documents with the old stripePromoCodeId field
    const promoCodes = await collection
      .find({ stripePromoCodeId: { $exists: true } })
      .toArray();

    console.log(`Found ${promoCodes.length} promo codes to migrate`);

    if (promoCodes.length === 0) {
      console.log("No promo codes found with old structure. Migration complete.");
      return;
    }

    // Process each promo code
    for (const promoCode of promoCodes) {
      try {
        // Create the new promoCodeProvider array
        const promoCodeProvider = [
          {
            id: promoCode.stripePromoCodeId,
            provider: "stripe"
          }
        ];

        // Update the document
        await collection.updateOne(
          { _id: promoCode._id },
          {
            $set: { promoCodeProvider },
            $unset: { stripePromoCodeId: "" }
          }
        );

        console.log(`Migrated promo code: ${promoCode.code} (${promoCode._id})`);
      } catch (error) {
        console.error(`Failed to migrate promo code ${promoCode.code}:`, error);
        throw error;
      }
    }

    console.log(`Successfully migrated ${promoCodes.length} promo codes`);
  }

  async down(): Promise<void> {
    console.log("Rolling back promo code provider migration...");

    const collection = this.db.collection(Collections.PROMOCODES);

    // Find all documents with the new promoCodeProvider field
    const promoCodes = await collection
      .find({ promoCodeProvider: { $exists: true } })
      .toArray();

    console.log(`Found ${promoCodes.length} promo codes to rollback`);

    if (promoCodes.length === 0) {
      console.log("No promo codes found with new structure. Rollback complete.");
      return;
    }

    // Process each promo code
    for (const promoCode of promoCodes) {
      try {
        // Find the stripe provider entry
        const stripeProvider = promoCode.promoCodeProvider?.find(
          (provider: any) => provider.provider === "stripe"
        );

        if (stripeProvider) {
          // Restore the old stripePromoCodeId field
          await collection.updateOne(
            { _id: promoCode._id },
            {
              $set: { stripePromoCodeId: stripeProvider.id },
              $unset: { promoCodeProvider: "" }
            }
          );

          console.log(`Rolled back promo code: ${promoCode.code} (${promoCode._id})`);
        } else {
          console.log(`No stripe provider found for promo code: ${promoCode.code}`);
        }
      } catch (error) {
        console.error(`Failed to rollback promo code ${promoCode.code}:`, error);
        throw error;
      }
    }

    console.log(`Successfully rolled back ${promoCodes.length} promo codes`);
  }
}

// Migration runner function
export async function runPromoCodeProviderMigration(
  mongoUrl: string,
  dbName: string,
  direction: "up" | "down" = "up"
): Promise<void> {
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(dbName);
    const migration = new MigratePromoCodeProviderMigration(db);

    if (direction === "up") {
      await migration.up();
    } else {
      await migration.down();
    }

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

// If this file is run directly
if (require.main === module) {
  const mongoUrl = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.DATABASE_NAME || "sparrow";
  const direction = (process.argv[2] as "up" | "down") || "up";

  runPromoCodeProviderMigration(mongoUrl, dbName, direction)
    .then(() => {
      console.log("Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}
