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
import { SchedulingModule } from './scheduling/scheduling.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { TelegramModule } from './telegram/telegram.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { BillingModule } from './billing/billing.module';
import { ObservabilityModule } from './observability/observability.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    ObservabilityModule,
    RateLimitModule,
    BillingModule,
    HealthModule,
    UsersModule,
    AuthModule,
    CompaniesModule,
    CompanyMembersModule,
    ServicesModule,
    EmployeesModule,
    SchedulingModule,
    AppointmentsModule,
    CustomersModule,
    ReviewsModule,
    WaitlistModule,
    DashboardModule,
    NotificationsModule,
    AuditModule,
    TelegramModule,
  ],
})
export class AppModule {}
