import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { CompanyMembersController } from './company-members.controller';
import { CompanyMembersService } from './company-members.service';
import { CompanyInvitationMailerService } from './company-invitation-mailer.service';
import { CompanyInvitationsController, InvitationAcceptanceController } from './company-invitations.controller';
import { CompanyInvitationsService } from './company-invitations.service';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [CompanyMembersController, CompanyInvitationsController, InvitationAcceptanceController],
  providers: [CompanyMembersService, CompanyInvitationsService, CompanyInvitationMailerService],
})
export class CompanyMembersModule {}
