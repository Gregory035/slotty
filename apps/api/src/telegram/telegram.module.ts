import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { CompaniesModule } from '../companies/companies.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';
import { TelegramApiService } from './telegram-api.service';
import { TelegramBookingService } from './telegram-booking.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TokenEncryptionService } from './token-encryption.service';

@Module({
  imports: [AuthModule, CompaniesModule, SchedulingModule, AppointmentsModule],
  controllers: [BotsController, TelegramWebhookController],
  providers: [
    BotsService,
    TelegramApiService,
    TelegramBookingService,
    TokenEncryptionService,
  ],
})
export class TelegramModule {}
