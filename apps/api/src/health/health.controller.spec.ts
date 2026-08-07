import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns service health', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'telegram-business-api',
      }),
    );
  });
});
