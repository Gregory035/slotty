import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { CompanyPermission } from '../companies/company-permission';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import {
  AvailabilityQueryDto,
  AvailabilityResponseDto,
} from './dto/availability.dto';
import { SchedulingService } from './scheduling.service';
import { RateLimits } from '../rate-limit/rate-limit.decorator';

@ApiTags('availability')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/availability')
export class AvailabilityController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get()
  @RequirePermissions(CompanyPermission.SCHEDULE_READ)
  @RateLimits({
    name: 'availability', identity: 'user_company',
    limitEnv: 'RATE_LIMIT_AVAILABILITY_MAX', windowEnv: 'RATE_LIMIT_AVAILABILITY_WINDOW_SECONDS',
    defaultLimit: 60, defaultWindowSeconds: 60,
  })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  getAvailability(
    @Param('companyId') companyId: string,
    @Query() query: AvailabilityQueryDto,
  ): Promise<AvailabilityResponseDto> {
    return this.scheduling.getAvailability(companyId, query);
  }
}
