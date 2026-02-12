import { Module, forwardRef } from "@nestjs/common";
import { NotificationRepository } from "./repositories/notification.repository";
import { NotificationService } from "./services/notification.service";
import { NotificationController } from "./controllers/notification.controller";
import { IdentityModule } from "../identity/identity.module";

@Module({
  imports: [forwardRef(() => IdentityModule)],
  providers: [NotificationRepository, NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationsModule {}
