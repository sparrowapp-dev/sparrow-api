import { NestFactory } from "@nestjs/core";
import { Module, Provider } from "@nestjs/common";
import { MongoClient, Db } from "mongodb";
import { ConfigModule, ConfigService } from "@nestjs/config";
import configuration from "./modules/common/config/configuration";
import { Collections } from "./modules/common/enum/database.collection.enum";

const databaseProvider: Provider = {
  provide: "DATABASE_CONNECTION",
  useFactory: async (configService: ConfigService): Promise<Db> => {
    const dbUrl = configService.get<string>("db.url");

    if (!dbUrl) {
      throw new Error("Database URL is not defined in the configuration.");
    }

    const client = new MongoClient(dbUrl);
    await client.connect();
    return client.db("sparrow");
  },
  inject: [ConfigService],
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
  providers: [databaseProvider],
})
class MigrationModule {}

/**
 * Migration script to convert stripePromoCodeId to promoCodeProvider array structure
 * Run with: npm run start:migration-promocode-provider
 */
const migratePromoCodeProvider = async (db: Db): Promise<void> => {
  console.log("🚀 Starting promo code provider migration...");

  try {
    const collection = db.collection(Collections.PROMOCODES);

    // Find all documents with the old stripePromoCodeId field
    const promoCodes = await collection
      .find({ stripePromoCodeId: { $exists: true } })
      .toArray();

    console.log(`📋 Found ${promoCodes.length} promo codes to migrate`);

    if (promoCodes.length === 0) {
      console.log("✅ No promo codes found with old structure. Migration complete.");
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

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

        // Update the document - add new field and remove old field
        const result = await collection.updateOne(
          { _id: promoCode._id },
          {
            $set: { promoCodeProvider },
            $unset: { stripePromoCodeId: "" }
          }
        );

        if (result.modifiedCount > 0) {
          migratedCount++;
          console.log(`✅ Migrated: ${promoCode.code} (ID: ${promoCode._id})`);
        } else {
          console.log(`⚠️  No changes made for: ${promoCode.code}`);
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to migrate promo code ${promoCode.code}:`, error);
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successfully migrated: ${migratedCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📋 Total processed: ${promoCodes.length}`);

    if (errorCount > 0) {
      throw new Error(`Migration completed with ${errorCount} errors`);
    }

    console.log("🎉 Promo code provider migration completed successfully!");

  } catch (error) {
    console.error("💥 Migration failed:", error);
    throw error;
  }
};

async function bootstrap() {
  try {
    const app = await NestFactory.createApplicationContext(MigrationModule);
    const db = app.get<Db>("DATABASE_CONNECTION");

    await migratePromoCodeProvider(db);

    await app.close();
    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

bootstrap();
