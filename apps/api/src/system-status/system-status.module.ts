import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { SystemStatusController } from './system-status.controller';
import { SystemStatusService } from './system-status.service';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [SystemStatusController],
  providers: [SystemStatusService],
})
export class SystemStatusModule {}
