import { ConfigService } from '@nestjs/config';
import { BotStatus } from '@prisma/client';
import { BotsService } from './bots.service';

describe('BotsService', () => {
  const companyId = '6b89a7b4-4ac8-4424-922a-5d4fc44322a0';
  const now = new Date();

  it('verifies the token, encrypts it, and configures a webhook', async () => {
    const prisma = {
      bot: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: '8d4ad235-cdb7-4df8-922d-e92e51a75d02',
            ...data,
            createdAt: now,
            updatedAt: now,
          }),
        ),
      },
    };
    const config = {
      get: jest.fn().mockReturnValue('https://api.example.com'),
    } as unknown as ConfigService;
    const encryption = {
      encrypt: jest.fn().mockReturnValue('encrypted-token'),
      decrypt: jest.fn(),
    };
    const telegramApi = {
      getMe: jest.fn().mockResolvedValue({
        id: 123456789,
        is_bot: true,
        first_name: 'Booking',
        username: 'booking_bot',
      }),
      setWebhook: jest.fn().mockResolvedValue(undefined),
      deleteWebhook: jest.fn(),
    };
    const service = new BotsService(
      prisma as any,
      config,
      encryption as any,
      telegramApi as any,
    );

    const result = await service.connect(companyId, {
      token: '123456789:telegram-bot-token-value',
    });

    expect(encryption.encrypt).toHaveBeenCalledWith(
      '123456789:telegram-bot-token-value',
    );
    expect(telegramApi.setWebhook).toHaveBeenCalledWith(
      '123456789:telegram-bot-token-value',
      expect.stringMatching(
        /^https:\/\/api\.example\.com\/api\/telegram\/webhooks\//,
      ),
      expect.any(String),
    );
    expect(result).toMatchObject({
      companyId,
      telegramBotId: '123456789',
      username: 'booking_bot',
      status: BotStatus.ACTIVE,
      webhookConfigured: true,
    });
    expect(JSON.stringify(result)).not.toContain('telegram-bot-token-value');
  });
});
