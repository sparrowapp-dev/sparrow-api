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

/**
 * Common Module provides global services and configurations used across the application.
 * Includes database connection setup, logging configuration, and various utility services.
 */
@Global()
@Module({
  imports: [WorkspaceModule], // Import the Workspace Module
  controllers: [],
  providers: [
    {
      provide: "DATABASE_CONNECTION",
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<Db> => {
        try {
          // Connect to MongoDB using the URL from ConfigService
          const client = await MongoClient.connect(configService.get("db.url"));
          return client.db("sparrow");
        } catch (e) {
          throw e;
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
    LoggingExceptionsFilter,
    ProducerService,
    ConsumerService,
    BlobStorageService,
  ],
  exports: [
    "DATABASE_CONNECTION",
    "ErrorLogger",
    ContextService,
    ApiResponseService,
    ParserService,
    LoggingExceptionsFilter,
    ProducerService,
    ConsumerService,
    BlobStorageService,
  ],
})
export class CommonModule {}
