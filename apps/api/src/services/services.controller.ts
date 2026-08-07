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
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceResponseDto } from './dto/service-response.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Post()
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiCreatedResponse({ type: ServiceResponseDto })
  create(
    @Param('companyId') companyId: string,
    @Body() input: CreateServiceDto,
  ): Promise<ServiceResponseDto> {
    return this.services.create(companyId, input);
  }

  @Get()
  @ApiOkResponse({ type: ServiceResponseDto, isArray: true })
  findAll(
    @Param('companyId') companyId: string,
  ): Promise<ServiceResponseDto[]> {
    return this.services.findAll(companyId);
  }

  @Get(':serviceId')
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiNotFoundResponse({ description: 'Service not found in this company' })
  findOne(
    @Param('companyId') companyId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<ServiceResponseDto> {
    return this.services.findOne(companyId, serviceId);
  }

  @Patch(':serviceId')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiOkResponse({ type: ServiceResponseDto })
  update(
    @Param('companyId') companyId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() input: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    return this.services.update(companyId, serviceId, input);
  }

  @Delete(':serviceId')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  softDelete(
    @Param('companyId') companyId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<void> {
    return this.services.softDelete(companyId, serviceId);
  }
}
