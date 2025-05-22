import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AppController } from "@app/app.controller";
import { AppService } from "@app/app.service";
import { ConfigModule } from "@nestjs/config";
import { AccessControlModule } from "nest-access-control";
import { roles } from "@app/app.roles";
import { EnvironmentVariables } from "@common/config/env.validation";
import { transformAndValidateSync } from "class-transformer-validator";
import configuration from "@common/config/configuration";
import { WorkspaceModule } from "../workspace/workspace.module";
import { CommonModule } from "../common/common.module";
import { IdentityModule } from "../identity/identity.module";
import { LoggerModule } from "nestjs-pino";
import pino from "pino";
import { APP_FILTER } from "@nestjs/core";
import { LoggingExceptionsFilter } from "../common/exception/logging.exception-filter";
import { ProxyModule } from "../proxy/proxy.module";
import {
  makeCounterProvider,
  makeGaugeProvider,
  PrometheusModule,
} from "@willsoto/nestjs-prometheus";
import { CustomMetricsMiddleware } from "./middleware/metrics.middleware";
import { AppRepository } from "./app.repository";
import { SentryModule } from "@sentry/nestjs/setup";
import { UserAdminModule } from "../user-admin/user-admin.module";

@Module({
  imports: [
    SentryModule.forRoot(),
    PrometheusModule.register({
      path: "/metrics",
      defaultMetrics: {
        enabled: false,
      },
    }),
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    LoggerModule.forRootAsync({
      useFactory: async () => {
        return {
          pinoHttp: {
            level: pino.levels.labels["30"],
            stream: pino.multistream([
              { stream: process.stdout },
              {
                stream: pino.destination({
                  dest: "./logs/info.log",
                  sync: true,
                  append: true,
                  mkdir: true,
                }),
              },
            ]),
          },
        };
      },
    }),
    AccessControlModule.forRoles(roles),
    ConfigModule,
    IdentityModule,
    WorkspaceModule,
    UserAdminModule,
    CommonModule,
    ProxyModule,
  ],
  controllers: [AppController],
  providers: [
    CustomMetricsMiddleware,
    makeCounterProvider({
      name: "count",
      help: "Number of HTTP requests",
      labelNames: ["method", "origin", "status", "environment"],
    }),
    makeGaugeProvider({
      name: "gauge",
      help: "Number of concurrent requests being processed",
      labelNames: ["method", "origin", "status", "environment"],
    }),
    makeGaugeProvider({
      name: "app_duration_metrics",
      help: "Duration of HTTP requests in milliseconds",
      labelNames: ["method", "origin", "status", "environment"],
    }),
    AppService,
    AppRepository,
    {
      provide: EnvironmentVariables,
      useValue: transformAndValidateSync(EnvironmentVariables, process.env),
    },
    {
      provide: APP_FILTER,
      useClass: LoggingExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    try {
      consumer.apply(CustomMetricsMiddleware).exclude("metrics").forRoutes("*");
    } catch (error) {
      console.error("Error configuring middleware:", error);
    }
  }
}
