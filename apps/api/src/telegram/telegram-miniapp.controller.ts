import { Body, Controller, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiExcludeController } from '@nestjs/swagger';
import { RateLimits } from '../rate-limit/rate-limit.decorator';
import { MiniAppAppointmentDto, MiniAppAvailabilityDto, MiniAppBookingDto, MiniAppFunnelEventDto, MiniAppRescheduleDto, MiniAppReviewDto, MiniAppSessionDto, MiniAppVisitBookingDto, MiniAppWorkPhotoDto } from './dto/mini-app.dto';
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

  @Post('appointments/review')
  review(@Param('companyId', ParseUUIDPipe) companyId: string, @Body() input: MiniAppReviewDto) {
    return this.miniApp.submitReview(companyId, input);
  }

  @Post('appointments/work-photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  workPhoto(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() input: MiniAppWorkPhotoDto,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    return this.miniApp.uploadWorkPhoto(companyId, input, file);
  }
}
