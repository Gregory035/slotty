import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../rate-limit/redis.service';

interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'API is available' })
  getHealth(): HealthResponse {
    return this.getLive();
  }

  @Get('live')
  @ApiOkResponse({ description: 'API process is alive' })
  getLive(): HealthResponse {
    return {
      status: 'ok',
      service: 'slotty-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'API dependencies are ready' })
  async getReady(): Promise<HealthResponse & { dependencies: string[] }> {
    try {
      await Promise.all([
        this.prisma.$queryRaw`SELECT 1`,
        this.redis.ping(),
      ]);
    } catch {
      throw new ServiceUnavailableException('Required dependency is unavailable');
    }
    return {
      ...this.getLive(),
      dependencies: ['postgresql', 'redis'],
    };
  }
}
