import { Allow, IsIn } from 'class-validator';
import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyPermission } from '../companies/company-permission';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { CursorQueryDto } from '../common/cursor-query.dto';
import { RateLimits } from '../rate-limit/rate-limit.decorator';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';

class CheckoutDto {
  @IsIn([SubscriptionPlan.STARTER, SubscriptionPlan.PRO])
  plan: Exclude<SubscriptionPlan, 'TRIAL'>;
}

class PaymentWebhookDto {
  @Allow()
  id?: unknown;

  @Allow()
  event?: unknown;

  @Allow()
  object?: unknown;
}

@Controller('companies/:companyId/billing')
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get()
  @RequirePermissions(CompanyPermission.PAYMENTS_READ)
  get(@Param('companyId') companyId: string) {
    return this.entitlements.get(companyId);
  }

  @Get('payments')
  @RequirePermissions(CompanyPermission.PAYMENTS_READ)
  payments(@Param('companyId') companyId: string, @Query() query: CursorQueryDto) {
    return this.billing.findPayments(companyId, query.limit, query.cursor);
  }

  @Post('checkout')
  @RequirePermissions(CompanyPermission.BILLING_MANAGE)
  checkout(
    @Param('companyId') companyId: string,
    @Body() input: CheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.billing.createCheckout(companyId, input.plan, idempotencyKey);
  }

  @Post('payments/:paymentId/sync')
  @RequirePermissions(CompanyPermission.BILLING_MANAGE)
  syncPayment(
    @Param('companyId') companyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.billing.syncPayment(companyId, paymentId);
  }
}

@Controller('payments/yookassa')
export class PaymentWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('webhook')
  @RateLimits({
    name: 'payment-webhook',
    identity: 'ip',
    limitEnv: 'RATE_LIMIT_WEBHOOK_MAX',
    windowEnv: 'RATE_LIMIT_WEBHOOK_WINDOW_SECONDS',
    defaultLimit: 120,
    defaultWindowSeconds: 60,
  })
  webhook(
    @Headers('x-payment-signature') signature: string | undefined,
    @Body() body: PaymentWebhookDto,
  ) {
    return this.billing.handleWebhook(signature, body as Record<string, unknown>);
  }
}
