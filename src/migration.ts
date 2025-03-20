import { NestFactory } from "@nestjs/core";
import { Module, Provider } from "@nestjs/common";
import { MongoClient, Db } from "mongodb";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AddWorkspaceIdMigration } from "../migrations/001-add-workspaceId";
import configuration from "./modules/common/config/configuration";

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
  providers: [databaseProvider, AddWorkspaceIdMigration],
})
class MigrationModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(MigrationModule);
  const migration = app.get(AddWorkspaceIdMigration);
  await migration.onModuleInit();
  await app.close();
}

bootstrap();
