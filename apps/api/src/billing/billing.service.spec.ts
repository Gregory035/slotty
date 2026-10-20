import { BadGatewayException } from '@nestjs/common';
import { PaymentStatus, Prisma, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { BillingService } from './billing.service';

describe('BillingService payment reconciliation', () => {
  const companyId = '6b89a7b4-4ac8-4424-922a-5d4fc44322a0';
  const payment = {
    id: '13c26f24-77ff-44e8-9bc9-28991f5d2856',
    companyId,
    subscriptionId: '4a552bda-b182-47de-91e0-810c789fcf93',
    externalPaymentId: 'provider-payment',
    amount: new Prisma.Decimal('990.00'),
    currency: 'RUB',
    planSnapshot: SubscriptionPlan.STARTER,
    status: PaymentStatus.PENDING,
  };
  const provider = {
    id: payment.externalPaymentId,
    status: 'succeeded',
    amount: { value: '990.00', currency: 'RUB' },
  };

  function setup() {
    const periodEnd = new Date(Date.now() + 5 * 86_400_000);
    const tx = {
      paymentEvent: { create: jest.fn().mockResolvedValue({}) },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          currentPeriodStartsAt: new Date(Date.now() - 25 * 86_400_000),
          currentPeriodEndsAt: periodEnd,
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([{ id: payment.subscriptionId }]),
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const config = { get: jest.fn((key: string) => ({
      YOOKASSA_SHOP_ID: 'shop',
      YOOKASSA_SECRET_KEY: 'secret',
    })[key as 'YOOKASSA_SHOP_ID' | 'YOOKASSA_SECRET_KEY']) };
    const service = new BillingService(prisma as never, config as never);
    return { service, tx, periodEnd };
  }

  afterEach(() => jest.restoreAllMocks());

  it('verifies the provider and extends the remaining paid period once', async () => {
    const { service, tx, periodEnd } = setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => provider,
    } as Response);
    tx.payment.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await service.syncPayment(companyId, payment.id);
    await service.handleWebhook({ object: { id: payment.externalPaymentId, status: 'succeeded' } });

    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
    const change = tx.subscription.update.mock.calls[0]?.[0] as {
      data: { currentPeriodEndsAt: Date };
    };
    expect(change.data.currentPeriodEndsAt.getTime()).toBe(
      periodEnd.getTime() + 30 * 86_400_000,
    );
    expect(tx.paymentEvent.create.mock.calls[0]?.[0]).toEqual(
      tx.paymentEvent.create.mock.calls[1]?.[0],
    );
  });

  it('rejects inconsistent provider amount before changing subscription', async () => {
    const { service, tx } = setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ...provider, amount: { value: '1.00', currency: 'RUB' } }),
    } as Response);

    await expect(service.handleWebhook({ object: { id: payment.externalPaymentId } }))
      .rejects.toBeInstanceOf(BadGatewayException);
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it('does not suspend an already paid period after another payment fails', async () => {
    const { service, tx } = setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ...provider, status: 'canceled' }),
    } as Response);

    await service.syncPayment(companyId, payment.id);

    expect(tx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ currentPeriodEndsAt: null }]),
        }),
      }),
    );
    expect(tx.subscription.update).not.toHaveBeenCalled();
  });

  it('creates one automatic payment for a period that is about to end', async () => {
    const periodEnd = new Date(Date.now() + 60_000);
    const subscription = {
      id: payment.subscriptionId,
      companyId,
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEndsAt: periodEnd,
      providerPaymentMethodId: 'saved-method',
    };
    const prisma = {
      subscription: { findMany: jest.fn().mockResolvedValue([subscription]) },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      companyMember: {
        findFirst: jest.fn().mockResolvedValue({ user: { email: 'owner@example.com' } }),
      },
    };
    const config = { get: jest.fn((key: string) => ({
      YOOKASSA_SHOP_ID: 'shop',
      YOOKASSA_SECRET_KEY: 'secret',
      YOOKASSA_VAT_CODE: 1,
    })[key as 'YOOKASSA_SHOP_ID' | 'YOOKASSA_SECRET_KEY' | 'YOOKASSA_VAT_CODE']) };
    const service = new BillingService(prisma as never, config as never);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'renewal-payment', status: 'pending' }),
    } as Response);

    await expect(service.processRenewals()).resolves.toBe(1);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual(expect.objectContaining({
      payment_method_id: 'saved-method',
      receipt: expect.objectContaining({ customer: { email: 'owner@example.com' } }),
    }));
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ renewalForPeriodEndAt: periodEnd }),
    });
  });
});
