import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthCookieService, CookieResponse } from '../auth/auth-cookie.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthResponseDto, AuthenticatedUserDto } from '../auth/dto/auth-response.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyMembershipContext } from '../companies/company-access.types';
import { CompanyPermission } from '../companies/company-permission';
import { CurrentCompanyMember } from '../companies/decorators/current-company-member.decorator';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { CompanyInvitationsService } from './company-invitations.service';
import { CompanyInvitationResponseDto, CreateCompanyInvitationDto, PublicCompanyInvitationDto, RegisterCompanyInvitationDto } from './dto/company-invitation.dto';
import { RateLimits } from '../rate-limit/rate-limit.decorator';

@ApiTags('company-invitations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/invitations')
export class CompanyInvitationsController {
  constructor(private readonly invitations: CompanyInvitationsService) {}

  @Get()
  @RequirePermissions(CompanyPermission.MEMBERS_READ)
  list(@Param('companyId') companyId: string): Promise<CompanyInvitationResponseDto[]> {
    return this.invitations.list(companyId);
  }

  @Post()
  @RequirePermissions(CompanyPermission.MEMBERS_MANAGE)
  create(
    @Param('companyId') companyId: string,
    @Body() input: CreateCompanyInvitationDto,
    @CurrentCompanyMember() actor: CompanyMembershipContext,
  ): Promise<CompanyInvitationResponseDto> {
    return this.invitations.create(companyId, input, actor);
  }

  @Delete(':invitationId')
  @RequirePermissions(CompanyPermission.MEMBERS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @Param('companyId') companyId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentCompanyMember() actor: CompanyMembershipContext,
  ): Promise<void> {
    return this.invitations.revoke(companyId, invitationId, actor.userId);
  }
}

@ApiTags('company-invitations')
@Controller('invitations')
export class InvitationAcceptanceController {
  constructor(
    private readonly invitations: CompanyInvitationsService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Get(':token')
  @RateLimits({ name: 'invitation-inspect', identity: 'ip', limitEnv: 'RATE_LIMIT_INVITATION_MAX', windowEnv: 'RATE_LIMIT_INVITATION_WINDOW_SECONDS', defaultLimit: 30, defaultWindowSeconds: 60 })
  inspect(@Param('token') token: string): Promise<PublicCompanyInvitationDto> {
    return this.invitations.inspect(token);
  }

  @Post(':token/register')
  @RateLimits({ name: 'invitation-register', identity: 'ip', limitEnv: 'RATE_LIMIT_INVITATION_REGISTER_MAX', windowEnv: 'RATE_LIMIT_INVITATION_REGISTER_WINDOW_SECONDS', defaultLimit: 5, defaultWindowSeconds: 3600 })
  async register(
    @Param('token') token: string,
    @Body() input: RegisterCompanyInvitationDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthResponseDto> {
    const session = await this.invitations.register(token, input);
    this.cookies.set(response, session.refreshToken);
    return session.response;
  }

  @Post(':token/accept')
  @UseGuards(AccessTokenGuard)
  @RateLimits({ name: 'invitation-accept', identity: 'session', limitEnv: 'RATE_LIMIT_INVITATION_ACCEPT_MAX', windowEnv: 'RATE_LIMIT_INVITATION_ACCEPT_WINDOW_SECONDS', defaultLimit: 10, defaultWindowSeconds: 3600 })
  async accept(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<{ companyId: string }> {
    return this.invitations.accept(token, user.id);
  }
}
