import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'API is available' })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'telegram-business-api',
      timestamp: new Date().toISOString(),
    };
  }
}
