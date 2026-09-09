import { Global, Module } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, RateLimitService, RateLimitGuard],
  exports: [RedisService, RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}
