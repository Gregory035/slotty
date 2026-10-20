import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { RateLimits } from '../rate-limit/rate-limit.decorator';
import { MiniAppAppointmentDto, MiniAppAvailabilityDto, MiniAppBookingDto, MiniAppFunnelEventDto, MiniAppRescheduleDto, MiniAppSessionDto, MiniAppVisitBookingDto } from './dto/mini-app.dto';
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

  @Post('book-visit')
  bookVisit(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() input: MiniAppVisitBookingDto,
  ) {
    return this.miniApp.createVisit(companyId, input);
  }

  @Post('event')
  event(@Param('companyId', ParseUUIDPipe) companyId: string, @Body() input: MiniAppFunnelEventDto) {
    return this.miniApp.recordFunnelEvent(companyId, input.initData, input.step);
  }

  @Post('appointments')
  appointments(@Param('companyId', ParseUUIDPipe) companyId: string, @Body() input: MiniAppSessionDto) {
    return this.miniApp.listAppointments(companyId, input.initData);
  }

  @Post('appointments/cancel')
  cancel(@Param('companyId', ParseUUIDPipe) companyId: string, @Body() input: MiniAppAppointmentDto) {
    return this.miniApp.cancelAppointment(companyId, input);
  }

  @Post('appointments/reschedule')
  reschedule(@Param('companyId', ParseUUIDPipe) companyId: string, @Body() input: MiniAppRescheduleDto) {
    return this.miniApp.rescheduleAppointment(companyId, input);
  }
}
