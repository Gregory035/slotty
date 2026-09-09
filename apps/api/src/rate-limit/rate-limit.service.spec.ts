import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  it('blocks requests above the distributed window limit', async () => {
    const redis = { consumeWindow: jest.fn().mockResolvedValue([6, 25_000]) };
    const config = { get: jest.fn().mockReturnValue(false) };
    const service = new RateLimitService(redis as any, config as any);
    await expect(service.consume('login:test', 5, 60)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 25,
    });
  });

  it('honors fail-closed mode when Redis is unavailable', async () => {
    const redis = { consumeWindow: jest.fn().mockRejectedValue(new Error('offline')) };
    const config = { get: jest.fn().mockReturnValue(false) };
    const service = new RateLimitService(redis as any, config as any);
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    await expect(service.consume('login:test', 5, 60)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });
});
