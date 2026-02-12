import { Module } from "@nestjs/common";
import { NotificationRepository } from "./repositories/notification.repository";
import { NotificationService } from "./services/notification.service";

@Module({
  providers: [NotificationRepository, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
