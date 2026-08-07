import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = createHash('sha256')
      .update(config.getOrThrow<string>('BOT_TOKEN_ENCRYPTION_KEY'))
      .digest();
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, ciphertext]
      .map((part) => part.toString('base64url'))
      .join('.');
  }

  decrypt(payload: string): string {
    try {
      const parts = payload.split('.');
      if (parts.length !== 3) throw new Error('Invalid encrypted payload');
      const iv = Buffer.from(parts[0]!, 'base64url');
      const authTag = Buffer.from(parts[1]!, 'base64url');
      const ciphertext = Buffer.from(parts[2]!, 'base64url');
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('Stored bot token cannot be decrypted');
    }
  }
}
