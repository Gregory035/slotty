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
import { CompanyRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyRoles } from '../companies/decorators/company-roles.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiCreatedResponse({ type: EmployeeResponseDto })
  create(
    @Param('companyId') companyId: string,
    @Body() input: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    return this.employees.create(companyId, input);
  }

  @Get()
  @ApiOkResponse({ type: EmployeeResponseDto, isArray: true })
  findAll(
    @Param('companyId') companyId: string,
  ): Promise<EmployeeResponseDto[]> {
    return this.employees.findAll(companyId);
  }

  @Get(':employeeId')
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiNotFoundResponse({ description: 'Employee not found in this company' })
  findOne(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ): Promise<EmployeeResponseDto> {
    return this.employees.findOne(companyId, employeeId);
  }

  @Patch(':employeeId')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiOkResponse({ type: EmployeeResponseDto })
  update(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() input: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    return this.employees.update(companyId, employeeId, input);
  }

  @Delete(':employeeId')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  softDelete(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ): Promise<void> {
    return this.employees.softDelete(companyId, employeeId);
  }

  @Post(':employeeId/services/:serviceId')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: EmployeeResponseDto })
  assignService(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<EmployeeResponseDto> {
    return this.employees.assignService(companyId, employeeId, serviceId);
  }

  @Delete(':employeeId/services/:serviceId')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiOkResponse({ type: EmployeeResponseDto })
  unassignService(
    @Param('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<EmployeeResponseDto> {
    return this.employees.unassignService(companyId, employeeId, serviceId);
  }
}
