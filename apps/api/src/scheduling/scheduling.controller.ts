import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CompanyRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyRoles } from '../companies/decorators/company-roles.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import {
  ReplaceScheduleDto,
  ScheduleRuleResponseDto,
} from './dto/replace-schedule.dto';
import {
  CreateScheduleExceptionDto,
  ScheduleExceptionListQueryDto,
  ScheduleExceptionResponseDto,
  UpdateScheduleExceptionDto,
} from './dto/schedule-exception.dto';
import { SchedulingService } from './scheduling.service';

@ApiTags('scheduling')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/employees/:employeeId/schedule')
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get()
  @ApiOkResponse({ type: ScheduleRuleResponseDto, isArray: true })
  findSchedule(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ): Promise<ScheduleRuleResponseDto[]> {
    return this.scheduling.findSchedule(companyId, employeeId);
  }

  @Put()
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiOkResponse({ type: ScheduleRuleResponseDto, isArray: true })
  replaceSchedule(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() input: ReplaceScheduleDto,
  ): Promise<ScheduleRuleResponseDto[]> {
    return this.scheduling.replaceSchedule(companyId, employeeId, input);
  }

  @Get('exceptions')
  @ApiOkResponse({ type: ScheduleExceptionResponseDto, isArray: true })
  findExceptions(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: ScheduleExceptionListQueryDto,
  ): Promise<ScheduleExceptionResponseDto[]> {
    return this.scheduling.findExceptions(companyId, employeeId, query);
  }

  @Post('exceptions')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiCreatedResponse({ type: ScheduleExceptionResponseDto })
  createException(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() input: CreateScheduleExceptionDto,
  ): Promise<ScheduleExceptionResponseDto> {
    return this.scheduling.createException(companyId, employeeId, input);
  }

  @Patch('exceptions/:exceptionId')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiOkResponse({ type: ScheduleExceptionResponseDto })
  updateException(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body() input: UpdateScheduleExceptionDto,
  ): Promise<ScheduleExceptionResponseDto> {
    return this.scheduling.updateException(
      companyId,
      employeeId,
      exceptionId,
      input,
    );
  }

  @Delete('exceptions/:exceptionId')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteException(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ): Promise<void> {
    return this.scheduling.deleteException(companyId, employeeId, exceptionId);
  }
}
