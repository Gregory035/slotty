import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

interface RequestLike { headers: Record<string, string | string[] | undefined>; requestId?: string }
interface ResponseLike { setHeader(name: string, value: string): void }

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestLike, response: ResponseLike, next: () => void): void {
    const supplied = request.headers['x-request-id'];
    const candidate = Array.isArray(supplied) ? supplied[0] : supplied;
    const requestId = candidate && /^[A-Za-z0-9._-]{1,100}$/.test(candidate) ? candidate : randomUUID();
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  }
}
