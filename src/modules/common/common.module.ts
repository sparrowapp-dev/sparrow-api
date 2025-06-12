import { Global, Module } from "@nestjs/common";
import { MongoClient, Db } from "mongodb";
import { ConfigService } from "@nestjs/config";
import pino from "pino";

// ---- Module
import { WorkspaceModule } from "../workspace/workspace.module";

// ---- Filter
import { LoggingExceptionsFilter } from "./exception/logging.exception-filter";

// ---- Services
import { ProducerService } from "./services/kafka/producer.service";
import { ConsumerService } from "./services/kafka/consumer.service";
import { BlobStorageService } from "./services/blobStorage.service";
import { ApiResponseService } from "./services/api-response.service";
import { ParserService } from "./services/parser.service";
import { ContextService } from "./services/context.service";
import { EmailService } from "./services/email.service";
import { InsightsService } from "./services/insights.service";
import { PostmanParserService } from "./services/postman.parser.service";
import { CreateUserMigration } from "migrations/create-test-user.migration";
import { InstrumentService } from "./services/instrument.service";

/**
 * Common Module provides global services and configurations used across the application.
 * Includes database connection setup, logging configuration, and various utility services.
 */
@Global()
@Module({
  imports: [WorkspaceModule], // Import the Workspace Module
  controllers: [],
  providers: [
    InsightsService,
    CreateUserMigration,
    {
      provide: "DATABASE_CONNECTION",
      inject: [ConfigService, InsightsService],
      useFactory: async (
        configService: ConfigService,
        insightsService: InsightsService,
      ): Promise<Db> => {
        try {
          const dbName = configService.get<string>("db.name");
          // Connect to MongoDB using the URL from ConfigService
          const client = await MongoClient.connect(configService.get("db.url"));
          return client.db(dbName);
        } catch (e) {
          console.log("ERROR =====> ", e);
          const client = await insightsService.getClient();
          if (client) {
            client.trackException({
              exception: e,
              properties: {
                status: 500,
                message: "MongoDB connection failure",
              },
            });
          } else {
            console.error("Application Insights client is not initialized.");
          }
        }
      },
    },
    {
      provide: "ErrorLogger",
      useValue: pino(
        {
          level: pino.levels.labels["50"], // Set the log level to "error"
        },
        pino.destination({
          dest: "./logs/error.log", // Specify the log file destination
          sync: true,
          append: true,
          mkdir: true,
        }),
      ),
    },
    ContextService,
    ApiResponseService,
    ParserService,
    PostmanParserService,
    LoggingExceptionsFilter,
    ProducerService,
    ConsumerService,
    BlobStorageService,
    EmailService,
    InstrumentService,
  ],
  exports: [
    "DATABASE_CONNECTION",
    "ErrorLogger",
    ContextService,
    ApiResponseService,
    ParserService,
    PostmanParserService,
    LoggingExceptionsFilter,
    ProducerService,
    ConsumerService,
    BlobStorageService,
    EmailService,
    InsightsService,
    InstrumentService,
  ],
})
export class CommonModule {}
