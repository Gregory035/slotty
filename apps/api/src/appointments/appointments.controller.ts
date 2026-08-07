import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CompanyRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyRoles } from '../companies/decorators/company-roles.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { AppointmentsService } from './appointments.service';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @ApiOkResponse({ type: AppointmentResponseDto, isArray: true })
  findAll(
    @Param('companyId') companyId: string,
    @Query() query: AppointmentQueryDto,
  ): Promise<AppointmentResponseDto[]> {
    return this.appointments.findAll(companyId, query);
  }

  @Patch(':appointmentId/status')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiOkResponse({ type: AppointmentResponseDto })
  updateStatus(
    @Param('companyId') companyId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() input: UpdateAppointmentStatusDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointments.updateStatus(companyId, appointmentId, input);
  }
}
