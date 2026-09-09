import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ErrorRequest { method: string; originalUrl?: string; url?: string; requestId?: string }
interface ErrorResponse { status(code: number): ErrorResponse; json(body: unknown): void }

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');
  private readonly trackingUrl?: string;

  constructor(config: ConfigService) {
    this.trackingUrl = config.get<string>('ERROR_TRACKING_URL');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ErrorRequest>();
    const response = http.getResponse<ErrorResponse>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const publicResponse = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    const body = typeof publicResponse === 'string' ? { message: publicResponse } : publicResponse;
    const event = {
      type: 'http_error',
      requestId: request.requestId,
      method: request.method,
      path: (request.originalUrl ?? request.url ?? '').split('?')[0],
      status,
      error: exception instanceof Error ? exception.name : 'UnknownError',
      message: status >= 500 && exception instanceof Error ? this.mask(exception.message) : undefined,
    };
    this.logger.error(JSON.stringify(event));
    if (status >= 500 && this.trackingUrl) {
      void fetch(this.trackingUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(2000),
      }).catch(() => undefined);
    }
    response.status(status).json({
      ...(typeof body === 'object' && body ? body : { message: body }),
      statusCode: status,
      requestId: request.requestId,
    });
  }

  private mask(value: string): string {
    return value
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g, '[TELEGRAM_TOKEN]')
      .slice(0, 1000);
  }
}
