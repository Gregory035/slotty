import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUserDto } from '../auth/dto/auth-response.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyMembershipContext } from '../companies/company-access.types';
import { CompanyPermission } from '../companies/company-permission';
import { CurrentCompanyMember } from '../companies/decorators/current-company-member.decorator';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { AppointmentsService } from './appointments.service';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { CreateAppointmentDto, RescheduleAppointmentDto } from './dto/create-appointment.dto';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateDepositStatusDto } from './dto/update-deposit-status.dto';
import { CursorPage } from '../common/pagination';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @RequirePermissions(CompanyPermission.APPOINTMENTS_READ)
  @ApiOkResponse({ type: AppointmentResponseDto, isArray: true })
  findAll(
    @Param('companyId') companyId: string,
    @Query() query: AppointmentQueryDto,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
  ): Promise<CursorPage<AppointmentResponseDto>> {
    return this.appointments.findAll(companyId, query, membership);
  }

  @Post()
  @RequirePermissions(CompanyPermission.APPOINTMENTS_CREATE)
  create(
    @Param('companyId') companyId: string,
    @Body() input: CreateAppointmentDto,
    @CurrentUser() user: AuthenticatedUserDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<AppointmentResponseDto> {
    return this.appointments.createFromDashboard(
      companyId,
      input,
      user.id,
      idempotencyKey?.trim() || undefined,
    );
  }

  @Post('visits')
  @RequirePermissions(CompanyPermission.APPOINTMENTS_CREATE)
  createVisit(
    @Param('companyId') companyId: string,
    @Body() input: CreateVisitDto,
    @CurrentUser() user: AuthenticatedUserDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<AppointmentResponseDto[]> {
    return this.appointments.createVisitFromDashboard(companyId, input, user.id, idempotencyKey?.trim());
  }

  @Get(':appointmentId/history')
  @RequirePermissions(CompanyPermission.APPOINTMENT_HISTORY_READ)
  history(
    @Param('companyId') companyId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.appointments.history(companyId, appointmentId);
  }

  @Get(':appointmentId/calendar.ics')
  @RequirePermissions(CompanyPermission.APPOINTMENTS_READ)
  async calendarInvite(
    @Param('companyId') companyId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    const ics = await this.appointments.calendarInvite(companyId, appointmentId, membership);
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="slotty-appointment.ics"');
    response.setHeader('Cache-Control', 'no-store');
    return ics;
  }

  @Patch(':appointmentId/reschedule')
  @RequirePermissions(CompanyPermission.APPOINTMENTS_CREATE)
  reschedule(
    @Param('companyId') companyId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() input: RescheduleAppointmentDto,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointments.reschedule(companyId, appointmentId, input, user.id);
  }

  @Patch(':appointmentId/status')
  @RequirePermissions(CompanyPermission.APPOINTMENTS_STATUS)
  @ApiOkResponse({ type: AppointmentResponseDto })
  updateStatus(
    @Param('companyId') companyId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() input: UpdateAppointmentStatusDto,
    @CurrentUser() user: AuthenticatedUserDto,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
  ): Promise<AppointmentResponseDto> {
    return this.appointments.updateStatus(
      companyId,
      appointmentId,
      input,
      membership,
      user.id,
    );
  }

  @Patch(':appointmentId/deposit')
  @RequirePermissions(CompanyPermission.APPOINTMENTS_STATUS)
  updateDeposit(
    @Param('companyId') companyId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() input: UpdateDepositStatusDto,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointments.updateDepositStatus(companyId, appointmentId, input.status, user.id);
  }
}
