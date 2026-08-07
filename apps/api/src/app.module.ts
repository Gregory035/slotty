import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { CompanyMembersModule } from './company-members/company-members.module';
import { ServicesModule } from './services/services.module';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    CompaniesModule,
    CompanyMembersModule,
    ServicesModule,
    EmployeesModule,
  ],
})
export class AppModule {}
