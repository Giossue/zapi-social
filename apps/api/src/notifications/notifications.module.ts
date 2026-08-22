import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [IdentityModule],
  controllers: [AdminNotificationsController, NotificationsController],
  providers: [AdminNotificationsService, NotificationsService],
})
export class NotificationsModule {}
