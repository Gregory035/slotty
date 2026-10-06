import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { RateLimits } from '../rate-limit/rate-limit.decorator';
import { MiniAppAvailabilityDto, MiniAppBookingDto, MiniAppSessionDto } from './dto/mini-app.dto';
import { TelegramMiniAppService } from './telegram-miniapp.service';

@ApiExcludeController()
@Controller('telegram/miniapp/:companyId')
@RateLimits({
  name: 'telegram-miniapp', identity: 'ip',
  limitEnv: 'RATE_LIMIT_AVAILABILITY_MAX', windowEnv: 'RATE_LIMIT_AVAILABILITY_WINDOW_SECONDS',
  defaultLimit: 60, defaultWindowSeconds: 60,
})
export class TelegramMiniAppController {
  constructor(private readonly miniApp: TelegramMiniAppService) {}

  @Post('session')
  session(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() input: MiniAppSessionDto,
  ) {
    return this.miniApp.getSession(companyId, input.initData);
  }

  @Post('availability')
  availability(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() input: MiniAppAvailabilityDto,
  ) {
    return this.miniApp.getAvailability(companyId, input);
  }

  @Post('book')
  book(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() input: MiniAppBookingDto,
  ) {
    return this.miniApp.createBooking(companyId, input);
  }
}
