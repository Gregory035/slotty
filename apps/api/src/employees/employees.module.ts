import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { ServicesModule } from '../services/services.module';
import { EmployeesController, PublicWorkExamplesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [AuthModule, CompaniesModule, ServicesModule],
  controllers: [EmployeesController, PublicWorkExamplesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
