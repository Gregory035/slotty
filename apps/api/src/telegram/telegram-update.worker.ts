import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Prisma, TelegramUpdate, TelegramUpdateStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TelegramBookingService } from './telegram-booking.service';

const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 5 * 60_000;
const RECOVERY_INTERVAL_MS = 60_000;

@Injectable()
export class TelegramUpdateWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramUpdateWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastRecovery = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: TelegramBookingService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.tick().catch((error: unknown) => {
        this.logger.error('Telegram update worker tick failed', error);
      });
    }, 250);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if (Date.now() - this.lastRecovery >= RECOVERY_INTERVAL_MS) {
        this.lastRecovery = Date.now();
        await this.prisma.telegramUpdate.updateMany({
          where: {
            status: TelegramUpdateStatus.PROCESSING,
            attempts: { gte: MAX_ATTEMPTS },
            updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) },
          },
          data: { status: TelegramUpdateStatus.FAILED, errorMessage: 'Worker stopped before processing completed' },
        });
      }
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
        WHERE (
          ("status" = 'PENDING' AND "availableAt" <= NOW())
          OR ("status" = 'PROCESSING' AND "updatedAt" < ${new Date(Date.now() - STALE_PROCESSING_MS)})
        )
        AND "attempts" < ${MAX_ATTEMPTS}
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
