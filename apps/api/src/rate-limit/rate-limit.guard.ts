import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import {
  RATE_LIMIT_RULES_KEY,
  RateLimitIdentity,
  RateLimitRule,
} from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

interface RateLimitRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  user?: { id: string };
}

interface RateLimitResponse {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[]>(
      RATE_LIMIT_RULES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rules?.length) return true;
    const http = context.switchToHttp();
    const request = http.getRequest<RateLimitRequest>();
    const response = http.getResponse<RateLimitResponse>();
    for (const rule of rules) {
      const limit = this.config.get<number>(rule.limitEnv) ?? rule.defaultLimit;
      const windowSeconds =
        this.config.get<number>(rule.windowEnv) ?? rule.defaultWindowSeconds;
      const identity = this.identity(rule.identity, request);
      const result = await this.limiter.consume(
        `${rule.name}:${identity}`,
        limit,
        windowSeconds,
      );
      if (!result.allowed) {
        response.setHeader('Retry-After', String(result.retryAfterSeconds));
        throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    return true;
  }

  private identity(type: RateLimitIdentity, request: RateLimitRequest): string {
    const ip = request.ip ?? 'unknown';
    const companyId = request.params.companyId ?? 'unknown';
    const values: Record<RateLimitIdentity, string> = {
      ip,
      email: String(request.body?.email ?? '').trim().toLowerCase() || 'unknown',
      session: this.first(request.headers.cookie) ?? ip,
      company: companyId,
      bot_ip: `${ip}:${request.params.secret ?? 'unknown'}`,
      user_company: `${request.user?.id ?? ip}:${companyId}`,
    };
    return createHash('sha256').update(values[type]).digest('hex');
  }

  private first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
