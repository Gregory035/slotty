import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

export function encodeUuid(value: string): string {
  if (!isUUID(value)) throw new BadRequestException('Invalid callback UUID');
  return Buffer.from(value.replaceAll('-', ''), 'hex').toString('base64url');
}

export function decodeUuid(value: string): string {
  try {
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.length !== 16) throw new Error('Invalid UUID length');
    const hex = bytes.toString('hex');
    const uuid = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
    if (!isUUID(uuid)) throw new Error('Invalid UUID');
    return uuid;
  } catch {
    throw new BadRequestException('Invalid callback UUID');
  }
}
