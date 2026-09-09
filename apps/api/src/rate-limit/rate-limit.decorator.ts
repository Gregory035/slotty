import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

export type RateLimitIdentity =
  | 'ip'
  | 'email'
  | 'session'
  | 'company'
  | 'bot_ip'
  | 'user_company';

export interface RateLimitRule {
  name: string;
  identity: RateLimitIdentity;
  limitEnv: string;
  windowEnv: string;
  defaultLimit: number;
  defaultWindowSeconds: number;
}

export const RATE_LIMIT_RULES_KEY = 'rateLimitRules';

export const RateLimits = (...rules: RateLimitRule[]) =>
  applyDecorators(SetMetadata(RATE_LIMIT_RULES_KEY, rules), UseGuards(RateLimitGuard));
