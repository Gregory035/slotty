import { Module } from '@nestjs/common';
import { TelegramApiService } from './telegram-api.service';
import { TokenEncryptionService } from './token-encryption.service';

@Module({
  providers: [TelegramApiService, TokenEncryptionService],
  exports: [TelegramApiService, TokenEncryptionService],
})
export class TelegramClientModule {}
