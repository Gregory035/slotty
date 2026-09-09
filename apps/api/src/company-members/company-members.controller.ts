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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { CompanyMembershipContext } from '../companies/company-access.types';
import { CompanyPermission } from '../companies/company-permission';
import { CurrentCompanyMember } from '../companies/decorators/current-company-member.decorator';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CursorQueryDto } from '../common/cursor-query.dto';
import { CursorPage } from '../common/pagination';
import { CompanyMembersService } from './company-members.service';
import { CompanyMemberResponseDto } from './dto/company-member-response.dto';
import { AddCompanyMemberDto, UpdateCompanyMemberDto } from './dto/manage-company-member.dto';

@ApiTags('company-members')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/members')
export class CompanyMembersController {
  constructor(private readonly members: CompanyMembersService) {}

  @Get()
  @RequirePermissions(CompanyPermission.MEMBERS_READ)
  @ApiOkResponse({ type: CompanyMemberResponseDto, isArray: true })
  @ApiForbiddenResponse({ description: 'User is not a company member' })
  findAll(
    @Param('companyId') companyId: string,
    @Query() query: CursorQueryDto,
  ): Promise<CursorPage<CompanyMemberResponseDto>> {
    return this.members.findAll(companyId, query.limit, query.cursor);
  }

  @Post()
  @RequirePermissions(CompanyPermission.MEMBERS_MANAGE)
  add(
    @Param('companyId') companyId: string,
    @Body() input: AddCompanyMemberDto,
    @CurrentCompanyMember() actor: CompanyMembershipContext,
  ): Promise<CompanyMemberResponseDto> {
    return this.members.add(companyId, input, actor);
  }

  @Patch(':memberId')
  @RequirePermissions(CompanyPermission.MEMBERS_MANAGE)
  update(
    @Param('companyId') companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() input: UpdateCompanyMemberDto,
    @CurrentCompanyMember() actor: CompanyMembershipContext,
  ): Promise<CompanyMemberResponseDto> {
    return this.members.update(companyId, memberId, input, actor);
  }

  @Delete(':memberId')
  @RequirePermissions(CompanyPermission.MEMBERS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('companyId') companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentCompanyMember() actor: CompanyMembershipContext,
  ): Promise<void> {
    return this.members.remove(companyId, memberId, actor);
  }
}
