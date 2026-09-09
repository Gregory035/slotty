import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
  const redis = { ping: jest.fn().mockResolvedValue(true) };

  it('returns service health', () => {
    const controller = new HealthController(prisma as any, redis as any);

    expect(controller.getHealth()).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'telegram-business-api',
      }),
    );
  });

  it('checks PostgreSQL and Redis readiness', async () => {
    const controller = new HealthController(prisma as any, redis as any);

    await expect(controller.getReady()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        dependencies: ['postgresql', 'redis'],
      }),
    );
  });
});
