import { Module } from "@nestjs/common";
import { NotificationRepository } from "./repositories/notification.repository";
import { NotificationService } from "./services/notification.service";
import { NotificationController } from "./controllers/notification.controller";

@Module({
  controllers: [NotificationController],
  providers: [NotificationRepository, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
