import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyPermission } from '../companies/company-permission';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { SystemStatusService } from './system-status.service';

@ApiTags('system-status')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/system-status')
export class SystemStatusController {
  constructor(private readonly systemStatus: SystemStatusService) {}

  @Get()
  @RequirePermissions(CompanyPermission.SYSTEM_READ)
  get(@Param('companyId') companyId: string) {
    return this.systemStatus.get(companyId);
  }
}
