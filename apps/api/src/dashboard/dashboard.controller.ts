import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyPermission } from '../companies/company-permission';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { DashboardService } from './dashboard.service';

class DashboardQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermissions(CompanyPermission.DASHBOARD_READ)
  get(@Param('companyId') companyId: string, @Query() query: DashboardQueryDto) {
    return this.dashboard.get(companyId, query);
  }

  @Get('export.csv')
  @RequirePermissions(CompanyPermission.DASHBOARD_READ)
  async exportCsv(
    @Param('companyId') companyId: string,
    @Query() query: DashboardQueryDto,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    const csv = await this.dashboard.exportCsv(companyId, query);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="slotty-report.csv"');
    response.setHeader('Cache-Control', 'no-store');
    return csv;
  }
}
