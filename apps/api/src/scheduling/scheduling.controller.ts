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
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyPermission } from '../companies/company-permission';
import { assertEmployeeScope, CompanyMembershipContext } from '../companies/company-access.types';
import { CurrentCompanyMember } from '../companies/decorators/current-company-member.decorator';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
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
  @RequirePermissions(CompanyPermission.SCHEDULE_READ)
  @ApiOkResponse({ type: ScheduleRuleResponseDto, isArray: true })
  findSchedule(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
  ): Promise<ScheduleRuleResponseDto[]> {
    assertEmployeeScope(membership, employeeId);
    return this.scheduling.findSchedule(companyId, employeeId);
  }

  @Put()
  @RequirePermissions(CompanyPermission.SCHEDULE_MANAGE)
  @ApiOkResponse({ type: ScheduleRuleResponseDto, isArray: true })
  replaceSchedule(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() input: ReplaceScheduleDto,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
  ): Promise<ScheduleRuleResponseDto[]> {
    assertEmployeeScope(membership, employeeId);
    return this.scheduling.replaceSchedule(companyId, employeeId, input, membership.userId);
  }

  @Get('exceptions')
  @RequirePermissions(CompanyPermission.SCHEDULE_READ)
  @ApiOkResponse({ type: ScheduleExceptionResponseDto, isArray: true })
  findExceptions(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: ScheduleExceptionListQueryDto,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
  ): Promise<ScheduleExceptionResponseDto[]> {
    assertEmployeeScope(membership, employeeId);
    return this.scheduling.findExceptions(companyId, employeeId, query);
  }

  @Post('exceptions')
  @RequirePermissions(CompanyPermission.SCHEDULE_MANAGE)
  @ApiCreatedResponse({ type: ScheduleExceptionResponseDto })
  createException(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() input: CreateScheduleExceptionDto,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
  ): Promise<ScheduleExceptionResponseDto> {
    assertEmployeeScope(membership, employeeId);
    return this.scheduling.createException(companyId, employeeId, input, membership.userId);
  }

  @Patch('exceptions/:exceptionId')
  @RequirePermissions(CompanyPermission.SCHEDULE_MANAGE)
  @ApiOkResponse({ type: ScheduleExceptionResponseDto })
  updateException(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body() input: UpdateScheduleExceptionDto,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
  ): Promise<ScheduleExceptionResponseDto> {
    assertEmployeeScope(membership, employeeId);
    return this.scheduling.updateException(
      companyId,
      employeeId,
      exceptionId,
      input,
      membership.userId,
    );
  }

  @Delete('exceptions/:exceptionId')
  @RequirePermissions(CompanyPermission.SCHEDULE_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteException(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
  ): Promise<void> {
    assertEmployeeScope(membership, employeeId);
    return this.scheduling.deleteException(
      companyId,
      employeeId,
      exceptionId,
      membership.userId,
    );
  }
}
