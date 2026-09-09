import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket, createConnection } from 'node:net';
import { connect as connectTls, TLSSocket } from 'node:tls';

type RedisReply = string | number | null | RedisReply[];

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly url: URL;
  private readonly timeoutMs: number;
  private activeSockets = new Set<Socket | TLSSocket>();

  constructor(config: ConfigService) {
    this.url = new URL(config.getOrThrow<string>('REDIS_URL'));
    this.timeoutMs = config.get<number>('REDIS_TIMEOUT_MS') ?? 1000;
  }

  async ping(): Promise<boolean> {
    return (await this.command(['PING'])) === 'PONG';
  }

  async consumeWindow(key: string, windowMs: number): Promise<[number, number]> {
    const script = [
      "local current = redis.call('INCR', KEYS[1])",
      "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
      "return {current, redis.call('PTTL', KEYS[1])}",
    ].join(' ');
    const result = await this.command([
      'EVAL',
      script,
      '1',
      key,
      String(windowMs),
    ]);
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('Unexpected Redis rate limit response');
    }
    return [Number(result[0]), Number(result[1])];
  }

  onModuleDestroy(): void {
    for (const socket of this.activeSockets) socket.destroy();
    this.activeSockets.clear();
  }

  private async command(command: string[]): Promise<RedisReply> {
    const commands: string[][] = [];
    if (this.url.password) {
      commands.push(
        this.url.username
          ? ['AUTH', decodeURIComponent(this.url.username), decodeURIComponent(this.url.password)]
          : ['AUTH', decodeURIComponent(this.url.password)],
      );
    }
    const database = this.url.pathname.replace('/', '');
    if (database && database !== '0') commands.push(['SELECT', database]);
    commands.push(command);
    const replies = await this.execute(commands);
    return replies[replies.length - 1]!;
  }

  private execute(commands: string[][]): Promise<RedisReply[]> {
    return new Promise<RedisReply[]>((resolve, reject) => {
      const port = Number(this.url.port || 6379);
      const socket =
        this.url.protocol === 'rediss:'
          ? connectTls({ host: this.url.hostname, port })
          : createConnection({ host: this.url.hostname, port });
      this.activeSockets.add(socket);
      const replies: RedisReply[] = [];
      let buffer = Buffer.alloc(0);
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        this.activeSockets.delete(socket);
        socket.destroy();
        if (error) reject(error);
        else resolve(replies);
      };
      socket.setTimeout(this.timeoutMs, () => finish(new Error('Redis timeout')));
      socket.once('error', () => finish(new Error('Redis unavailable')));
      socket.on('data', (chunk: Buffer) => {
        try {
          buffer = Buffer.concat([buffer, chunk]);
          while (buffer.length && !settled) {
            const parsed = this.parseReply(buffer, 0);
            if (!parsed) break;
            replies.push(parsed.value);
            buffer = buffer.subarray(parsed.next);
            if (replies.length === commands.length) finish();
          }
        } catch (error) {
          finish(error instanceof Error ? error : new Error('Invalid Redis response'));
        }
      });
      socket.once(this.url.protocol === 'rediss:' ? 'secureConnect' : 'connect', () => {
        socket.write(commands.map((item) => this.encode(item)).join(''));
      });
    }).catch((error) => {
      this.logger.debug('Redis command failed');
      throw error;
    });
  }

  private encode(parts: string[]): string {
    return `*${parts.length}\r\n${parts
      .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
      .join('')}`;
  }

  private parseReply(
    buffer: Buffer,
    offset: number,
  ): { value: RedisReply; next: number } | null {
    if (offset >= buffer.length) return null;
    const marker = String.fromCharCode(buffer[offset]!);
    const lineEnd = buffer.indexOf('\r\n', offset);
    if (lineEnd < 0) return null;
    const line = buffer.subarray(offset + 1, lineEnd).toString();
    const nextLine = lineEnd + 2;
    if (marker === '+' || marker === ':') {
      return { value: marker === ':' ? Number(line) : line, next: nextLine };
    }
    if (marker === '-') throw new Error('Redis command rejected');
    if (marker === '$') {
      const length = Number(line);
      if (length === -1) return { value: null, next: nextLine };
      const end = nextLine + length;
      if (buffer.length < end + 2) return null;
      return { value: buffer.subarray(nextLine, end).toString(), next: end + 2 };
    }
    if (marker === '*') {
      const count = Number(line);
      const values: RedisReply[] = [];
      let next = nextLine;
      for (let index = 0; index < count; index += 1) {
        const parsed = this.parseReply(buffer, next);
        if (!parsed) return null;
        values.push(parsed.value);
        next = parsed.next;
      }
      return { value: values, next };
    }
    throw new Error('Unsupported Redis response');
  }
}
