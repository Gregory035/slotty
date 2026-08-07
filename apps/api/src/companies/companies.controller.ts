import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CompanyRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUserDto } from '../auth/dto/auth-response.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyMembershipContext } from './company-access.types';
import { CompaniesService } from './companies.service';
import { CompanyRoles } from './decorators/company-roles.decorator';
import { CurrentCompanyMember } from './decorators/current-company-member.decorator';
import { CompanyResponseDto } from './dto/company-response.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyAccessGuard } from './guards/company-access.guard';

@ApiTags('companies')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Post()
  @ApiCreatedResponse({ type: CompanyResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUserDto,
    @Body() input: CreateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return this.companies.create(user.id, input);
  }

  @Get()
  @ApiOkResponse({ type: CompanyResponseDto, isArray: true })
  findAll(
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<CompanyResponseDto[]> {
    return this.companies.findAllForUser(user.id);
  }

  @Get(':companyId')
  @UseGuards(CompanyAccessGuard)
  @ApiOkResponse({ type: CompanyResponseDto })
  @ApiForbiddenResponse({ description: 'User is not a company member' })
  findOne(
    @Param('companyId') companyId: string,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
  ): Promise<CompanyResponseDto> {
    return this.companies.findById(companyId, membership.role);
  }

  @Patch(':companyId')
  @UseGuards(CompanyAccessGuard)
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiOkResponse({ type: CompanyResponseDto })
  @ApiForbiddenResponse({ description: 'OWNER or ADMIN role is required' })
  update(
    @Param('companyId') companyId: string,
    @CurrentCompanyMember() membership: CompanyMembershipContext,
    @Body() input: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return this.companies.update(companyId, membership.role, input);
  }
}
