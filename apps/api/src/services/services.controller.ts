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
  @RequirePermissions(CompanyPermission.SERVICES_MANAGE)
  @ApiCreatedResponse({ type: ServiceResponseDto })
  create(
    @Param('companyId') companyId: string,
    @Body() input: CreateServiceDto,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<ServiceResponseDto> {
    return this.services.create(companyId, input, user.id);
  }

  @Get()
  @RequirePermissions(CompanyPermission.SERVICES_READ)
  @ApiOkResponse({ type: ServiceResponseDto, isArray: true })
  findAll(
    @Param('companyId') companyId: string,
  ): Promise<ServiceResponseDto[]> {
    return this.services.findAll(companyId);
  }

  @Get(':serviceId')
  @RequirePermissions(CompanyPermission.SERVICES_READ)
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiNotFoundResponse({ description: 'Service not found in this company' })
  findOne(
    @Param('companyId') companyId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<ServiceResponseDto> {
    return this.services.findOne(companyId, serviceId);
  }

  @Patch(':serviceId')
  @RequirePermissions(CompanyPermission.SERVICES_MANAGE)
  @ApiOkResponse({ type: ServiceResponseDto })
  update(
    @Param('companyId') companyId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() input: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<ServiceResponseDto> {
    return this.services.update(companyId, serviceId, input, user.id);
  }

  @Delete(':serviceId')
  @RequirePermissions(CompanyPermission.SERVICES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  softDelete(
    @Param('companyId') companyId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<void> {
    return this.services.softDelete(companyId, serviceId, user.id);
  }
}
