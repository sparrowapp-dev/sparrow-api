import { Global, Module } from "@nestjs/common";
import { MongoClient, Db } from "mongodb";
import { ContextService } from "./services/context.service";
import { Redis } from "ioredis";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "./services/redis.service";
import { WorkspaceModule } from "../workspace/workspace.module";
import { ApiResponseService } from "./services/api-response.service";
import { ParserService } from "./services/parser.service";
import { LoggingExceptionsFilter } from "./exception/logging.exception-filter";
import pino from "pino";
import { ProducerService } from "./services/kafka/producer.service";
import { ConsumerService } from "./services/kafka/consumer.service";

@Global()
@Module({
  imports: [WorkspaceModule],
  controllers: [],
  providers: [
    {
      provide: "DATABASE_CONNECTION",
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<Db> => {
        try {
          const client = await MongoClient.connect(configService.get("db.url"));
          return client.db();
        } catch (e) {
          throw e;
        }
      },
    },
    {
      provide: Redis,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Redis({
          host: configService.get("redis.host"),
          port: configService.get("redis.port"),
          db: configService.get("redis.db"),
        }),
    },
    {
      provide: "ErrorLogger",
      useValue: pino(
        {
          level: pino.levels.labels["50"],
        },
        pino.destination({
          dest: "./logs/error.log",
          sync: true,
          append: true,
          mkdir: true,
        }),
      ),
    },
    ContextService,
    RedisService,
    ApiResponseService,
    ParserService,
    LoggingExceptionsFilter,
    ProducerService,
    ConsumerService,
  ],
  exports: [
    "DATABASE_CONNECTION",
    "ErrorLogger",
    Redis,
    ContextService,
    RedisService,
    ApiResponseService,
    ParserService,
    LoggingExceptionsFilter,
    ProducerService,
    ConsumerService,
  ],
})
export class CommonModule {}
