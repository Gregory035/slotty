import { ConfigService } from '@nestjs/config';
import { PushService } from './push.service';

describe('PushService', () => {
  const upsert = jest.fn();
  const deleteMany = jest.fn();
  const prisma = { webPushSubscription: { upsert, deleteMany } };

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
});
