import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { CompanyMembersController } from './company-members.controller';
import { CompanyMembersService } from './company-members.service';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [CompanyMembersController],
  providers: [CompanyMembersService],
})
export class CompanyMembersModule {}
