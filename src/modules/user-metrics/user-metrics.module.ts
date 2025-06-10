import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { UserMetricsService } from "./services/user-metrics.service";
import { UserMetricsRepository } from "./repositories/user-metrics.repository";
import { UserMetricsController } from "./controllers/user-metrics.controller";

/**
 * Module for user metrics tracking and monitoring
 */
@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable scheduled tasks
  ],
  controllers: [UserMetricsController],
  providers: [UserMetricsService, UserMetricsRepository],
  exports: [UserMetricsService, UserMetricsRepository],
})
export class UserMetricsModule {}
