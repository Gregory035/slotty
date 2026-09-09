import { Module } from '@nestjs/common';
import { TelegramClientModule } from '../telegram/telegram-client.module';
import { NotificationWorker } from './notification.worker';
import { OutboxWorker } from './outbox.worker';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { NotificationsController } from './notifications.controller';
import { WaitlistModule } from '../waitlist/waitlist.module';

@Module({
  imports: [TelegramClientModule, AuthModule, CompaniesModule, WaitlistModule],
  controllers: [NotificationsController],
  providers: [OutboxWorker, NotificationWorker],
  exports: [OutboxWorker, NotificationWorker],
})
export class NotificationsModule {}
