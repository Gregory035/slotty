import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import {
  AvailabilityQueryDto,
  AvailabilityResponseDto,
} from './dto/availability.dto';
import { SchedulingService } from './scheduling.service';

@ApiTags('availability')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/availability')
export class AvailabilityController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get()
  @ApiOkResponse({ type: AvailabilityResponseDto })
  getAvailability(
    @Param('companyId') companyId: string,
    @Query() query: AvailabilityQueryDto,
  ): Promise<AvailabilityResponseDto> {
    return this.scheduling.getAvailability(companyId, query);
  }
}
