import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenEncryptionService } from './token-encryption.service';

describe('TokenEncryptionService', () => {
  const config = {
    getOrThrow: jest.fn().mockReturnValue('test-secret-that-is-at-least-32-characters'),
  } as unknown as ConfigService;
  const service = new TokenEncryptionService(config);

  it('encrypts and decrypts a bot token without storing plaintext', () => {
    const token = '123456789:telegram-bot-token-value';
    const encrypted = service.encrypt(token);

    expect(encrypted).not.toContain(token);
    expect(service.decrypt(encrypted)).toBe(token);
  });

  it('rejects a modified encrypted payload', () => {
    const encrypted = service.encrypt('123456789:telegram-bot-token-value');
    const parts = encrypted.split('.');
    parts[2] = `${parts[2]!.startsWith('A') ? 'B' : 'A'}${parts[2]!.slice(1)}`;

    expect(() => service.decrypt(parts.join('.'))).toThrow(
      InternalServerErrorException,
    );
  });
});
