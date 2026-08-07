import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
  iat: number;
  exp: number;
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(config: ConfigService) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  signAccessToken(user: { id: string; email: string }): string {
    const now = Math.floor(Date.now() / 1000);
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const payload = this.encode({
      sub: user.id,
      email: user.email,
      type: 'access',
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
    } satisfies AccessTokenPayload);
    const signingInput = `${header}.${payload}`;

    return `${signingInput}.${this.signature(signingInput, this.accessSecret)}`;
  }

  createRefreshToken(): string {
    const value = randomBytes(48).toString('base64url');
    return `${value}.${this.signature(value, this.refreshSecret)}`;
  }

  verifyRefreshToken(token: string): boolean {
    if (token.length > 512) {
      return false;
    }

    const [value, signatureValue] = token.split('.');
    if (!value || !signatureValue) {
      return false;
    }

    const expectedSignature = Buffer.from(
      this.signature(value, this.refreshSecret),
    );
    const actualSignature = Buffer.from(signatureValue);

    return (
      expectedSignature.length === actualSignature.length &&
      timingSafeEqual(expectedSignature, actualSignature)
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload | null {
    if (token.length > 4096) {
      return null;
    }

    const [headerValue, payloadValue, signatureValue] = token.split('.');

    if (!headerValue || !payloadValue || !signatureValue) {
      return null;
    }

    const signingInput = `${headerValue}.${payloadValue}`;
    const expectedSignature = Buffer.from(
      this.signature(signingInput, this.accessSecret),
    );
    const actualSignature = Buffer.from(signatureValue);

    if (
      expectedSignature.length !== actualSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      return null;
    }

    try {
      const header = JSON.parse(Buffer.from(headerValue, 'base64url').toString()) as Record<string, unknown>;
      const payload = JSON.parse(Buffer.from(payloadValue, 'base64url').toString()) as Partial<AccessTokenPayload>;
      const now = Math.floor(Date.now() / 1000);

      if (
        header.alg !== 'HS256' ||
        header.typ !== 'JWT' ||
        payload.type !== 'access' ||
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number' ||
        payload.iat > now + 60 ||
        payload.exp <= now
      ) {
        return null;
      }

      return payload as AccessTokenPayload;
    } catch {
      return null;
    }
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private signature(value: string, secret: string): string {
    return createHmac('sha256', secret).update(value).digest('base64url');
  }
}
