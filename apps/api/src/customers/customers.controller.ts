import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUserDto } from '../auth/dto/auth-response.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyPermission } from '../companies/company-permission';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { CustomersService } from './customers.service';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { ImportCustomersDto } from './dto/import-customers.dto';
import { SetCustomerBlacklistDto, UpdateCustomerDto } from './dto/update-customer.dto';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions(CompanyPermission.CUSTOMERS_READ)
  findAll(@Param('companyId') companyId: string, @Query() query: CustomerQueryDto) {
    return this.customers.findAll(companyId, query);
  }

  @Get('export.csv')
  @RequirePermissions(CompanyPermission.CUSTOMERS_MANAGE)
  async exportCsv(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUserDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const csv = await this.customers.exportCsv(companyId, user.id);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="slotty-customers.csv"');
    response.setHeader('Cache-Control', 'no-store');
    return csv;
  }

  @Post('import')
  @RequirePermissions(CompanyPermission.CUSTOMERS_MANAGE)
  importCustomers(
    @Param('companyId') companyId: string,
    @Body() input: ImportCustomersDto,
    @CurrentUser() user: AuthenticatedUserDto,
  ) {
    return this.customers.importRows(companyId, input.rows, user.id);
  }

  @Get(':customerId')
  @RequirePermissions(CompanyPermission.CUSTOMERS_READ)
  findOne(@Param('companyId') companyId: string, @Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.customers.findOne(companyId, customerId);
  }

  @Patch(':customerId')
  @RequirePermissions(CompanyPermission.CUSTOMERS_MANAGE)
  update(@Param('companyId') companyId: string, @Param('customerId', ParseUUIDPipe) customerId: string, @Body() input: UpdateCustomerDto, @CurrentUser() user: AuthenticatedUserDto) {
    return this.customers.update(companyId, customerId, input, user.id);
  }

  @Post(':customerId/blacklist')
  @RequirePermissions(CompanyPermission.CUSTOMERS_MANAGE)
  blacklist(@Param('companyId') companyId: string, @Param('customerId', ParseUUIDPipe) customerId: string, @Body() input: SetCustomerBlacklistDto, @CurrentUser() user: AuthenticatedUserDto) {
    return this.customers.setBlacklist(companyId, customerId, input, user.id);
  }

  @Delete(':customerId/personal-data')
  @RequirePermissions(CompanyPermission.CUSTOMERS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  anonymize(@Param('companyId') companyId: string, @Param('customerId', ParseUUIDPipe) customerId: string, @CurrentUser() user: AuthenticatedUserDto) {
    return this.customers.anonymize(companyId, customerId, user.id);
  }
}
