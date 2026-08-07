import { Injectable } from '@nestjs/common';
import { promisify } from 'node:util';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

    return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [algorithm, saltValue, hashValue] = storedHash.split('$');

    if (algorithm !== 'scrypt' || !saltValue || !hashValue) {
      return false;
    }

    try {
      const salt = Buffer.from(saltValue, 'base64url');
      const expected = Buffer.from(hashValue, 'base64url');
      const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;

      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }
}
