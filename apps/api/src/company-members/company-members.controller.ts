import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { CompanyMembersService } from './company-members.service';
import { CompanyMemberResponseDto } from './dto/company-member-response.dto';

@ApiTags('company-members')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/members')
export class CompanyMembersController {
  constructor(private readonly members: CompanyMembersService) {}

  @Get()
  @ApiOkResponse({ type: CompanyMemberResponseDto, isArray: true })
  @ApiForbiddenResponse({ description: 'User is not a company member' })
  findAll(
    @Param('companyId') companyId: string,
  ): Promise<CompanyMemberResponseDto[]> {
    return this.members.findAll(companyId);
  }
}
