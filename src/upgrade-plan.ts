import { NestFactory } from "@nestjs/core";
import { Module, Provider } from "@nestjs/common";
import { MongoClient, Db } from "mongodb";
import { ConfigModule, ConfigService } from "@nestjs/config";
import configuration from "./modules/common/config/configuration";

import { UpgradePlanMigration } from "migrations/upgrade-plan.migration";
import { UpdateTestflowHistoryPlanMigration } from "migrations/update-plan-testflow-history.migration";

const databaseProvider: Provider = {
  provide: "DATABASE_CONNECTION",
  useFactory: async (configService: ConfigService): Promise<Db> => {
    const dbUrl = configService.get<string>("db.url");
    const dbName = configService.get<string>("db.name");

    if (!dbUrl) {
      throw new Error("Database URL is not defined in the configuration.");
    }

    const client = new MongoClient(dbUrl);
    await client.connect();
    return client.db(dbName);
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
  providers: [
    databaseProvider,
    UpgradePlanMigration,
    UpdateTestflowHistoryPlanMigration,
  ],
})
class MigrationModule {}

async function run() {
  const app = await NestFactory.createApplicationContext(MigrationModule);

  const upgradeMigration = app.get(UpgradePlanMigration);
  await upgradeMigration.onModuleInit();

  const runHistoryMigration = app.get(UpdateTestflowHistoryPlanMigration);
  await runHistoryMigration.onModuleInit();

  await app.close();
}

run();
