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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUserDto } from '../auth/dto/auth-response.dto';
import { CompanyPermission } from '../companies/company-permission';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';
import { AssignEmployeeServiceDto } from './dto/assign-service.dto';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  @RequirePermissions(CompanyPermission.EMPLOYEES_MANAGE)
  @ApiCreatedResponse({ type: EmployeeResponseDto })
  create(
    @Param('companyId') companyId: string,
    @Body() input: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<EmployeeResponseDto> {
    return this.employees.create(companyId, input, user.id);
  }

  @Get()
  @RequirePermissions(CompanyPermission.EMPLOYEES_READ)
  @ApiOkResponse({ type: EmployeeResponseDto, isArray: true })
  findAll(
    @Param('companyId') companyId: string,
  ): Promise<EmployeeResponseDto[]> {
    return this.employees.findAll(companyId);
  }

  @Get(':employeeId')
  @RequirePermissions(CompanyPermission.EMPLOYEES_READ)
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiNotFoundResponse({ description: 'Employee not found in this company' })
  findOne(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ): Promise<EmployeeResponseDto> {
    return this.employees.findOne(companyId, employeeId);
  }

  @Patch(':employeeId')
  @RequirePermissions(CompanyPermission.EMPLOYEES_MANAGE)
  @ApiOkResponse({ type: EmployeeResponseDto })
  update(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() input: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<EmployeeResponseDto> {
    return this.employees.update(companyId, employeeId, input, user.id);
  }

  @Delete(':employeeId')
  @RequirePermissions(CompanyPermission.EMPLOYEES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  softDelete(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<void> {
    return this.employees.softDelete(companyId, employeeId, user.id);
  }

  @Post(':employeeId/services/:serviceId')
  @RequirePermissions(CompanyPermission.EMPLOYEES_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: EmployeeResponseDto })
  assignService(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() input: AssignEmployeeServiceDto,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<EmployeeResponseDto> {
    return this.employees.assignService(companyId, employeeId, serviceId, input, user.id);
  }

  @Delete(':employeeId/services/:serviceId')
  @RequirePermissions(CompanyPermission.EMPLOYEES_MANAGE)
  @ApiOkResponse({ type: EmployeeResponseDto })
  unassignService(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<EmployeeResponseDto> {
    return this.employees.unassignService(companyId, employeeId, serviceId, user.id);
  }
}
