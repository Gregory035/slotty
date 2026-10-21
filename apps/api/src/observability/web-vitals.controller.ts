import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RateLimits } from '../rate-limit/rate-limit.decorator';
import { MetricsService } from './metrics.service';

const publicPaths = ['/', '/online-zapis', '/zapis-cherez-telegram', '/dlya-mastera', '/dlya-salona'] as const;

class WebVitalDto {
  @IsIn(['CLS', 'INP', 'LCP'])
  name: 'CLS' | 'INP' | 'LCP';

  @IsNumber()
  @Min(0)
  @Max(3_600_000)
  value: number;

  @IsIn(['good', 'needs-improvement', 'poor'])
  rating: 'good' | 'needs-improvement' | 'poor';

  @IsIn(publicPaths)
  path: (typeof publicPaths)[number];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  navigationType?: string;
}

@Controller('telemetry')
export class WebVitalsController {
  constructor(private readonly metrics: MetricsService) {}

  @Post('web-vitals')
  @HttpCode(204)
  @RateLimits({
    name: 'web-vitals',
    identity: 'ip',
    limitEnv: 'RATE_LIMIT_WEB_VITALS_MAX',
    windowEnv: 'RATE_LIMIT_WEB_VITALS_WINDOW_SECONDS',
    defaultLimit: 30,
    defaultWindowSeconds: 60,
  })
  async record(@Body() input: WebVitalDto): Promise<void> {
    await this.metrics.recordWebVital(input);
  }
}
