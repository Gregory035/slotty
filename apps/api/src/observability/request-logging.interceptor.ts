import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

interface HttpRequest { method: string; originalUrl?: string; url?: string; requestId?: string }
interface HttpResponse { statusCode: number }

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<HttpResponse>();
    const startedAt = performance.now();
    let errorStatus: number | undefined;
    return next.handle().pipe(
      catchError((error: unknown) => {
        errorStatus = error instanceof HttpException ? error.getStatus() : 500;
        return throwError(() => error);
      }),
      finalize(() => {
      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
      const path = request.originalUrl ?? request.url ?? '';
      const status = errorStatus ?? response.statusCode;
      this.metrics.recordRequest(durationMs, status, path);
      this.logger.log(JSON.stringify({
        type: 'http_request',
        requestId: request.requestId,
        method: request.method,
        path: path.split('?')[0],
        status,
        durationMs,
      }));
      }),
    );
  }
}
