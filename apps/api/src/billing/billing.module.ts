import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { BillingController, PaymentWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';

@Global()
@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [BillingController, PaymentWebhookController],
  providers: [EntitlementsService, BillingService],
  exports: [EntitlementsService, BillingService],
})
export class BillingModule {}
