import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentStatus,
  Prisma,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { CursorPage, decodeCursor, pageFromRows } from '../common/pagination';
import { PrismaService } from '../database/prisma.service';

const PRICE: Record<Exclude<SubscriptionPlan, 'TRIAL'>, string> = {
  STARTER: '990.00',
  PRO: '2490.00',
};

interface YooKassaPayment {
  id: string;
  status: string;
  confirmation?: { confirmation_url?: string };
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createCheckout(
    companyId: string,
    plan: Exclude<SubscriptionPlan, 'TRIAL'>,
    idempotencyKey?: string,
  ) {
    const shopId = this.config.get<string>('YOOKASSA_SHOP_ID');
    const secretKey = this.config.get<string>('YOOKASSA_SECRET_KEY');
    const returnUrl = this.config.get<string>('PAYMENT_RETURN_URL');
    if (!shopId || !secretKey || !returnUrl) {
      throw new ServiceUnavailableException('Payment provider is not configured');
    }
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`,
        'content-type': 'application/json',
        'idempotence-key': idempotencyKey?.slice(0, 64) || randomUUID(),
      },
      body: JSON.stringify({
        amount: { value: PRICE[plan], currency: 'RUB' },
        capture: true,
        confirmation: { type: 'redirect', return_url: returnUrl },
        description: `Подписка ${plan}`,
        metadata: { companyId, plan },
      }),
    });
    if (!response.ok) throw new BadGatewayException('Payment provider is unavailable');
    const provider = (await response.json()) as YooKassaPayment;
    if (!provider.id || !provider.confirmation?.confirmation_url) {
      throw new BadGatewayException('Invalid payment provider response');
    }
    const payment = await this.prisma.payment.upsert({
      where: { provider_externalPaymentId: { provider: 'yookassa', externalPaymentId: provider.id } },
      update: {},
      create: {
        companyId,
        subscriptionId: subscription.id,
        provider: 'yookassa',
        externalPaymentId: provider.id,
        amount: new Prisma.Decimal(PRICE[plan]),
        currency: 'RUB',
        status: PaymentStatus.PENDING,
        planSnapshot: plan,
      },
    });
    return {
      paymentId: payment.id,
      providerPaymentId: provider.id,
      status: payment.status,
      confirmationUrl: provider.confirmation.confirmation_url,
    };
  }

  async handleWebhook(signature: string | undefined, body: Record<string, unknown>): Promise<void> {
    const secret = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!secret) throw new ServiceUnavailableException('Payment webhook is not configured');
    const raw = JSON.stringify(body);
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    if (!signature || !this.safeEqual(expected, signature)) {
      throw new UnauthorizedException('Invalid payment signature');
    }
    const object = body.object as Record<string, unknown> | undefined;
    const providerPaymentId = typeof object?.id === 'string' ? object.id : '';
    const providerStatus = typeof object?.status === 'string' ? object.status : '';
    const eventName = typeof body.event === 'string' ? body.event : 'payment.updated';
    const externalEventId =
      typeof body.id === 'string'
        ? body.id
        : `${eventName}:${providerPaymentId}:${providerStatus}`;
    if (!providerPaymentId || !providerStatus) {
      throw new NotFoundException('Payment event is incomplete');
    }
    const payment = await this.prisma.payment.findUnique({
      where: {
        provider_externalPaymentId: {
          provider: 'yookassa',
          externalPaymentId: providerPaymentId,
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    await this.applyProviderUpdate(payment, providerStatus, externalEventId, createHash('sha256').update(raw).digest('hex'));
  }

  async syncPayment(companyId: string, paymentId: string) {
    const shopId = this.config.get<string>('YOOKASSA_SHOP_ID');
    const secretKey = this.config.get<string>('YOOKASSA_SECRET_KEY');
    if (!shopId || !secretKey) throw new ServiceUnavailableException('Payment provider is not configured');
    const payment = await this.prisma.payment.findUnique({ where: { id_companyId: { id: paymentId, companyId } } });
    if (!payment) throw new NotFoundException('Payment not found');
    const response = await fetch(`https://api.yookassa.ru/v3/payments/${payment.externalPaymentId}`, {
      headers: { authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}` },
    });
    if (!response.ok) throw new BadGatewayException('Payment provider is unavailable');
    const provider = (await response.json()) as YooKassaPayment;
    await this.applyProviderUpdate(
      payment,
      provider.status,
      `sync:${provider.id}:${provider.status}`,
      createHash('sha256').update(JSON.stringify(provider)).digest('hex'),
    );
    const updated = await this.prisma.payment.findUnique({ where: { id_companyId: { id: paymentId, companyId } } });
    return updated ? { ...updated, amount: updated.amount.toFixed(2) } : null;
  }

  private async applyProviderUpdate(
    payment: { id: string; companyId: string; subscriptionId: string | null; planSnapshot: SubscriptionPlan },
    providerStatus: string,
    externalEventId: string,
    payloadHash: string,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentEvent.create({
          data: {
            companyId: payment.companyId,
            provider: 'yookassa',
            externalEventId,
            payloadHash,
          },
        });
        const status = this.paymentStatus(providerStatus);
        await tx.payment.update({
          where: { id_companyId: { id: payment.id, companyId: payment.companyId } },
          data: { status, paidAt: status === PaymentStatus.SUCCEEDED ? new Date() : null },
        });
        if (payment.subscriptionId) {
          if (status === PaymentStatus.SUCCEEDED) {
            const startsAt = new Date();
            const endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
            await tx.subscription.update({
              where: { id_companyId: { id: payment.subscriptionId, companyId: payment.companyId } },
              data: {
                plan: payment.planSnapshot,
                status: SubscriptionStatus.ACTIVE,
                currentPeriodStartsAt: startsAt,
                currentPeriodEndsAt: endsAt,
                graceEndsAt: null,
              },
            });
          } else if (status === PaymentStatus.FAILED) {
            await tx.subscription.update({
              where: { id_companyId: { id: payment.subscriptionId, companyId: payment.companyId } },
              data: {
                status: SubscriptionStatus.PAST_DUE,
                graceEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
            });
          }
        }
        await tx.auditLog.create({
          data: {
            companyId: payment.companyId,
            action: 'billing.payment_updated',
            entityType: 'Payment',
            entityId: payment.id,
            metadata: { status, provider: 'yookassa' },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
  }

  async findPayments(companyId: string, limit: number, cursorValue?: string): Promise<CursorPage<unknown>> {
    const cursor = decodeCursor(cursorValue);
    const rows = await this.prisma.payment.findMany({
      where: {
        companyId,
        ...(cursor
          ? { OR: [
              { createdAt: { lt: new Date(cursor.date) } },
              { createdAt: new Date(cursor.date), id: { lt: cursor.id } },
            ] }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const safe = rows.map((row) => ({
      ...row,
      amount: row.amount.toFixed(2),
    }));
    return pageFromRows(safe, limit, (row) => ({ date: row.createdAt.toISOString(), id: row.id }));
  }

  private paymentStatus(status: string): PaymentStatus {
    if (status === 'succeeded') return PaymentStatus.SUCCEEDED;
    if (['canceled', 'failed'].includes(status)) return PaymentStatus.FAILED;
    if (status === 'refunded') return PaymentStatus.REFUNDED;
    return PaymentStatus.PENDING;
  }

  private safeEqual(expected: string, actual: string): boolean {
    const left = Buffer.from(expected);
    const right = Buffer.from(actual.trim());
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
