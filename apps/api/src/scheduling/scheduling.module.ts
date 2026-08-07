import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { AvailabilityController } from './availability.controller';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [SchedulingController, AvailabilityController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
