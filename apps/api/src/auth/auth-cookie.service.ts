import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const REFRESH_COOKIE_NAME = 'tb_refresh';
export const REFRESH_COOKIE_PATH = '/api/auth';
export const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface CookieResponse {
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax';
      path: string;
      maxAge: number;
    },
  ): void;
  clearCookie(
    name: string,
    options: { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string },
  ): void;
}

@Injectable()
export class AuthCookieService {
  private readonly webOrigin: string;
  private readonly secure: boolean;

  constructor(config: ConfigService) {
    this.webOrigin = new URL(config.getOrThrow<string>('WEB_URL')).origin;
    this.secure = config.get<string>('NODE_ENV') === 'production';
  }

  read(cookieHeader?: string): string | null {
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(';')) {
      const [rawName, ...rawValue] = part.trim().split('=');
      if (rawName === REFRESH_COOKIE_NAME) {
        return decodeURIComponent(rawValue.join('='));
      }
    }
    return null;
  }

  set(response: CookieResponse, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }

  clear(response: CookieResponse): void {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
  }

  assertTrustedOrigin(headers: Record<string, string | string[] | undefined>): void {
    const origin = this.first(headers.origin);
    const referer = this.first(headers.referer);
    const suppliedOrigin = origin ?? (referer ? new URL(referer).origin : null);
    if (suppliedOrigin && suppliedOrigin !== this.webOrigin) {
      throw new ForbiddenException('Untrusted request origin');
    }
  }

  private first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
