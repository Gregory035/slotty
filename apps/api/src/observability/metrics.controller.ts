import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService, private readonly config: ConfigService) {}

  @Get()
  get(@Headers('authorization') authorization?: string) {
    const token = this.config.get<string>('METRICS_TOKEN');
    if (token && authorization !== `Bearer ${token}`) throw new UnauthorizedException();
    return this.metrics.snapshot();
  }
}
