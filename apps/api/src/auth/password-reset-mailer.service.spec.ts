import { ServiceUnavailableException } from '@nestjs/common';
import { PasswordResetMailerService } from './password-reset-mailer.service';

describe('PasswordResetMailerService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requires Resend configuration in production', () => {
    const config = { get: jest.fn((key: string) => key === 'NODE_ENV' ? 'production' : undefined) } as any;
    expect(() => new PasswordResetMailerService(config).assertConfigured()).toThrow(ServiceUnavailableException);
  });

  it('sends a recovery email through Resend without exposing the key in the payload', async () => {
    const values: Record<string, string> = {
      NODE_ENV: 'production',
      RESEND_API_KEY: 'test-secret-key',
      PASSWORD_RESET_FROM_EMAIL: 'Slotty <support@slotty23.ru>',
    };
    const config = { get: jest.fn((key: string) => values[key]) } as any;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any;
    const service = new PasswordResetMailerService(config);
    service.assertConfigured();
    await service.send({ email: 'client@example.com', firstName: 'Анна', resetUrl: 'https://slotty23.ru/app?mode=reset-password#token=value', expiresInMinutes: 30 });
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(request.headers.authorization).toBe('Bearer test-secret-key');
    expect(request.body).not.toContain('test-secret-key');
    expect(request.body).toContain('client@example.com');
  });

  it('reports provider failures without logging secrets', async () => {
    const values: Record<string, string> = { RESEND_API_KEY: 'secret', PASSWORD_RESET_FROM_EMAIL: 'Slotty <support@slotty23.ru>' };
    const config = { get: jest.fn((key: string) => values[key]) } as any;
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 }) as any;
    await expect(new PasswordResetMailerService(config).send({ email: 'client@example.com', firstName: 'Анна', resetUrl: 'https://slotty23.ru/reset', expiresInMinutes: 30 })).rejects.toThrow(ServiceUnavailableException);
  });
});
