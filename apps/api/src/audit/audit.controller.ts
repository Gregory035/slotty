import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyPermission } from '../companies/company-permission';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { CurrentCompanyMember } from '../companies/decorators/current-company-member.decorator';
import { CompanyMembershipContext } from '../companies/company-access.types';
import { CursorQueryDto } from '../common/cursor-query.dto';
import { AuditService } from './audit.service';

class AuditQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(CompanyPermission.AUDIT_READ)
  findAll(
    @Param('companyId') companyId: string,
    @Query() query: AuditQueryDto,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
  ) {
    return this.audit.findAll(companyId, query, membership.role);
  }
}
