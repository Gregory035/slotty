import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { PushService } from './push.service';

jest.mock('web-push', () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: jest.fn() },
}));

describe('PushService', () => {
  const upsert = jest.fn();
  const deleteMany = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const preferenceUpsert = jest.fn();
  const prisma = {
    webPushSubscription: { upsert, deleteMany, findMany },
    pushPreference: { findUnique, upsert: preferenceUpsert },
  };

  beforeEach(() => jest.clearAllMocks());

  it('reports disabled when VAPID keys are not configured', () => {
    const service = new PushService(prisma as never, new ConfigService({}));
    expect(service.config()).toEqual({ enabled: false, publicKey: null });
  });

  it('stores a browser subscription for the authenticated user', async () => {
    upsert.mockResolvedValue({});
    const service = new PushService(prisma as never, new ConfigService({}));
    await service.save('user-id', {
      endpoint: 'https://push.example.test/subscription',
      keys: { p256dh: 'p'.repeat(32), auth: 'a'.repeat(16) },
    }, 'Test Browser');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { endpoint: 'https://push.example.test/subscription' },
      create: expect.objectContaining({ userId: 'user-id', userAgent: 'Test Browser' }),
    }));
  });

  it('only removes a subscription belonging to the current user', async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    const service = new PushService(prisma as never, new ConfigService({}));
    await service.remove('user-id', 'https://push.example.test/subscription');
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', endpoint: 'https://push.example.test/subscription' },
    });
  });

  it('uses enabled defaults until a preference row exists', async () => {
    findUnique.mockResolvedValue(null);
    const service = new PushService(prisma as never, new ConfigService({}));
    await expect(service.preferences('user-id')).resolves.toEqual({
      appointmentCreated: true,
      appointmentRescheduled: true,
      appointmentCancelled: true,
    });
  });

  it('includes the assigned employee and respects event preferences', async () => {
    findMany.mockResolvedValue([
      { id: 'one', endpoint: 'https://push.test/one', p256dh: 'p', auth: 'a', user: { pushPreference: null } },
      { id: 'two', endpoint: 'https://push.test/two', p256dh: 'p', auth: 'a', user: { pushPreference: { appointmentCreated: false } } },
    ]);
    jest.mocked(webpush.sendNotification).mockResolvedValue({} as never);
    const service = new PushService(prisma as never, new ConfigService({
      WEB_PUSH_PUBLIC_KEY: 'public', WEB_PUSH_PRIVATE_KEY: 'private', WEB_PUSH_SUBJECT: 'mailto:test@example.com',
    }));
    await expect(service.sendToCompany('company-id', {
      title: 'Новая запись', body: 'Тест', url: '/app', tag: 'test',
    }, { event: 'appointment.created', employeeId: 'employee-id' })).resolves.toBe(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { user: { memberships: { some: expect.objectContaining({ companyId: 'company-id' }) } } },
    }));
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });
});
