import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Prisma, TelegramUpdate, TelegramUpdateStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TelegramBookingService } from './telegram-booking.service';

const MAX_ATTEMPTS = 5;

@Injectable()
export class TelegramUpdateWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramUpdateWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: TelegramBookingService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), 250);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let count = 0; count < 20; count += 1) {
        const update = await this.claim();
        if (!update) break;
        await this.process(update);
      }
    } finally {
      this.running = false;
    }
  }

  private async claim(): Promise<TelegramUpdate | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "TelegramUpdate"
      SET "status" = 'PROCESSING', "attempts" = "attempts" + 1, "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id" FROM "TelegramUpdate"
        WHERE "status" = 'PENDING' AND "availableAt" <= NOW()
        ORDER BY "availableAt", "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id"
    `);
    if (!rows[0]) return null;
    return this.prisma.telegramUpdate.findUnique({ where: { id: rows[0].id } });
  }

  private async process(update: TelegramUpdate): Promise<void> {
    try {
      await this.booking.processQueuedUpdate(update.id);
      await this.prisma.telegramUpdate.update({
        where: { id: update.id },
        data: {
          status: TelegramUpdateStatus.PROCESSED,
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error';
      const failed = update.attempts >= MAX_ATTEMPTS;
      await this.prisma.telegramUpdate.update({
        where: { id: update.id },
        data: {
          status: failed ? TelegramUpdateStatus.FAILED : TelegramUpdateStatus.PENDING,
          availableAt: new Date(
            Date.now() + Math.min(60_000, 1000 * 2 ** Math.max(0, update.attempts - 1)),
          ),
          errorMessage: message,
        },
      });
      this.logger.warn(`Telegram update ${update.id} failed: ${message}`);
    }
  }
}
