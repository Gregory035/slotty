import { ConfigService } from '@nestjs/config';
import { BotStatus } from '@prisma/client';
import { BotsService } from './bots.service';
import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';

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
      { assertCanConnectBot: jest.fn().mockResolvedValue(undefined) } as any,
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

  describe('bot profile photos', () => {
    let prisma: any;
    let telegramApi: any;
    let service: BotsService;
    const botId = '8d4ad235-cdb7-4df8-922d-e92e51a75d02';
    beforeEach(() => {
      const bot = { id: botId, companyId, telegramBotId: BigInt(123), username: 'test_bot', tokenEncrypted: 'encrypted', status: BotStatus.ACTIVE, createdAt: now, updatedAt: now };
      prisma = { bot: { findFirst: jest.fn().mockResolvedValue(bot), update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...bot, ...data })) }, auditLog: { create: jest.fn() } };
      prisma.$transaction = jest.fn((callback) => callback(prisma));
      telegramApi = { setProfilePhoto: jest.fn().mockResolvedValue(undefined) };
      service = new BotsService(prisma, new ConfigService({}), { decrypt: () => 'secret-token' } as any, telegramApi, {} as any);
    });

    async function photo() {
      const buffer = await sharp({ create: { width: 80, height: 60, channels: 4, background: '#C7FF31' } }).png().toBuffer();
      return { buffer, mimetype: 'image/png', size: buffer.length };
    }

    it('converts the image to square JPEG and saves only after Telegram accepts it', async () => {
      const result = await service.setProfilePhoto(companyId, botId, await photo(), 'owner-id');
      const sent = telegramApi.setProfilePhoto.mock.calls[0][1];
      const metadata = await sharp(sent).metadata();
      expect(metadata).toMatchObject({ format: 'jpeg', width: 640, height: 640 });
      expect(telegramApi.setProfilePhoto).toHaveBeenCalledWith('secret-token', expect.any(Buffer));
      expect(prisma.bot.findFirst).toHaveBeenCalledWith({ where: { id: botId, companyId } });
      expect(result.hasProfilePhoto).toBe(true);
      expect(JSON.stringify(result)).not.toContain('secret-token');
      expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'bot.avatar_updated', actorId: 'owner-id' }) });
    });

    it('does not save a successful state when Telegram rejects the avatar', async () => {
      telegramApi.setProfilePhoto.mockRejectedValue(new Error('provider rejected secret-token'));
      await expect(service.setProfilePhoto(companyId, botId, await photo(), 'owner-id')).rejects.toBeInstanceOf(BadGatewayException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects malformed image contents before calling Telegram', async () => {
      await expect(service.setProfilePhoto(companyId, botId, { buffer: Buffer.from('<svg/>'), mimetype: 'image/jpeg', size: 6 }, 'owner-id')).rejects.toBeInstanceOf(BadRequestException);
      expect(telegramApi.setProfilePhoto).not.toHaveBeenCalled();
    });

    it('rejects another company bot before processing or uploading a photo', async () => {
      prisma.bot.findFirst.mockResolvedValue(null);
      await expect(service.setProfilePhoto('other-company', botId, await photo(), 'owner-id')).rejects.toBeInstanceOf(NotFoundException);
      expect(telegramApi.setProfilePhoto).not.toHaveBeenCalled();
    });
  });
});
