import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyAccessGuard } from './guards/company-access.guard';

@Module({
  imports: [AuthModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyAccessGuard],
  exports: [CompaniesService, CompanyAccessGuard],
})
export class CompaniesModule {}
