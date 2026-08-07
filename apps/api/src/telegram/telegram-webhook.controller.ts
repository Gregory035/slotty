import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Update } from 'grammy/types';
import { TelegramBookingService } from './telegram-booking.service';

@ApiExcludeController()
@Controller('telegram/webhooks')
export class TelegramWebhookController {
  constructor(private readonly booking: TelegramBookingService) {}

  @Post(':secret')
  @HttpCode(HttpStatus.OK)
  handle(
    @Param('secret') secret: string,
    @Headers('x-telegram-bot-api-secret-token') headerSecret: string | undefined,
    @Body() update: Update,
  ): Promise<void> {
    return this.booking.handleWebhook(secret, headerSecret, update);
  }
}
