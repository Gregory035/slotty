import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly failOpen: boolean;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.failOpen = config.get<boolean>('RATE_LIMIT_FAIL_OPEN') ?? true;
  }

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    try {
      const [count, ttlMs] = await this.redis.consumeWindow(
        `rate-limit:${key}`,
        windowSeconds * 1000,
      );
      return {
        allowed: count <= limit,
        retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    } catch {
      this.logger.warn(
        `Redis unavailable; rate limiter is ${this.failOpen ? 'fail-open' : 'fail-closed'}`,
      );
      return { allowed: this.failOpen, retryAfterSeconds: 1 };
    }
  }
}
