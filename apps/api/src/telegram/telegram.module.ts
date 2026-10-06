import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { CompaniesModule } from '../companies/companies.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';
import { TelegramBookingService } from './telegram-booking.service';
import { TelegramClientModule } from './telegram-client.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramUpdateWorker } from './telegram-update.worker';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { TelegramMiniAppController } from './telegram-miniapp.controller';
import { TelegramMiniAppService } from './telegram-miniapp.service';

@Module({
  imports: [
    AuthModule,
    CompaniesModule,
    SchedulingModule,
    AppointmentsModule,
    TelegramClientModule,
    WaitlistModule,
  ],
  controllers: [BotsController, TelegramWebhookController, TelegramMiniAppController],
  providers: [
    BotsService,
    TelegramBookingService,
    TelegramMiniAppService,
    TelegramUpdateWorker,
  ],
})
export class TelegramModule {}
