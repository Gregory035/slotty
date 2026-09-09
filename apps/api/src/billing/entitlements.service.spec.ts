import { HttpException } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  function serviceWith(usage: { employees?: number; services?: number; appointments?: number; bots?: number }) {
    const prisma = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          plan: SubscriptionPlan.TRIAL,
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: new Date(Date.now() + 86_400_000),
          currentPeriodEndsAt: null,
          graceEndsAt: null,
        }),
      },
      employee: { count: jest.fn().mockResolvedValue(usage.employees ?? 0) },
      service: { count: jest.fn().mockResolvedValue(usage.services ?? 0) },
      appointment: { count: jest.fn().mockResolvedValue(usage.appointments ?? 0) },
      bot: { count: jest.fn().mockResolvedValue(usage.bots ?? 0) },
    };
    return new EntitlementsService(prisma as any);
  }

  it('rejects creating an employee above the trial limit', async () => {
    await expect(serviceWith({ employees: 3 }).assertCanCreateEmployee('company')).rejects.toMatchObject({ status: 402 });
  });

  it('allows usage below the plan limit', async () => {
    await expect(serviceWith({ employees: 2 }).assertCanCreateEmployee('company')).resolves.toBeUndefined();
  });

  it('rejects writes after the trial expires', async () => {
    const service = serviceWith({});
    (service as any).prisma.subscription.findFirst.mockResolvedValue({
      plan: SubscriptionPlan.TRIAL,
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: new Date(Date.now() - 1),
      currentPeriodEndsAt: null,
      graceEndsAt: null,
    });
    await expect(service.assertCanCreateService('company')).rejects.toBeInstanceOf(HttpException);
  });
});
