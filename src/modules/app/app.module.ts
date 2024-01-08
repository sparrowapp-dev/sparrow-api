import { Module } from "@nestjs/common";
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

@Module({
  imports: [
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
    CommonModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
export class AppModule {}
