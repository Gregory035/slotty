import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  BotStatus,
  Notification,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InlineKeyboard } from 'grammy';
import { encodeUuid } from '../telegram/callback-data.util';
import { TelegramApiService } from '../telegram/telegram-api.service';
import { TokenEncryptionService } from '../telegram/token-encryption.service';

const MAX_ATTEMPTS = 5;

@Injectable()
export class NotificationWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
    private readonly telegram: TelegramApiService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), 500);
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
        const notification = await this.claim();
        if (!notification) break;
        await this.send(notification);
      }
    } finally {
      this.running = false;
    }
  }

  private async claim(): Promise<Notification | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "Notification"
      SET "status" = 'PROCESSING', "attempts" = "attempts" + 1, "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id" FROM "Notification"
        WHERE "status" = 'PENDING' AND "scheduledAt" <= NOW()
        ORDER BY "scheduledAt", "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id"
    `);
    if (!rows[0]) return null;
    return this.prisma.notification.findUnique({ where: { id: rows[0].id } });
  }

  private async send(notification: Notification): Promise<void> {
    try {
      const record = await this.prisma.notification.findUnique({
        where: { id_companyId: { id: notification.id, companyId: notification.companyId } },
        include: {
          customer: true,
          appointment: { include: { company: true, employee: true, service: true } },
          company: { include: { bots: { where: { status: BotStatus.ACTIVE }, take: 1 } } },
        },
      });
      if (!record || record.status !== NotificationStatus.PROCESSING) return;
      if (!record.customer.telegramId) {
        await this.cancel(record.id, record.companyId, 'Customer has no Telegram account');
        return;
      }
      const bot = record.company.bots[0];
      if (!bot) throw new Error('Active Telegram bot is not configured');
      if (!record.appointment) throw new Error('Appointment is unavailable');
      const keyboard = record.type === NotificationType.APPOINTMENT_REMINDER
        ? new InlineKeyboard()
            .text('Подтвердить визит', `cf:${encodeUuid(record.appointment.id)}`)
            .row()
            .text('Перенести', `r:${encodeUuid(record.appointment.id)}`)
            .text('Отменить', `x:${encodeUuid(record.appointment.id)}`)
        : record.type === NotificationType.REBOOK_OFFER
          ? new InlineKeyboard().text('Записаться снова', `p:${encodeUuid(record.appointment.id)}`)
          : record.type === NotificationType.WAITLIST_SLOT
            ? new InlineKeyboard().text('Выбрать время', `p:${encodeUuid(record.appointment.id)}`)
          : undefined;
      await this.telegram.sendMessage(
        this.encryption.decrypt(bot.tokenEncrypted),
        record.customer.telegramId.toString(),
        this.text(record.type, record.appointment),
        keyboard,
      );
      await this.prisma.notification.update({
        where: { id_companyId: { id: record.id, companyId: record.companyId } },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          errorMessage: null,
          lastError: null,
        },
      });
    } catch (error) {
      const lastError = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error';
      const failed = notification.attempts >= MAX_ATTEMPTS;
      await this.prisma.notification.update({
        where: { id_companyId: { id: notification.id, companyId: notification.companyId } },
        data: {
          status: failed ? NotificationStatus.FAILED : NotificationStatus.PENDING,
          scheduledAt: new Date(Date.now() + Math.min(60_000, 1000 * 2 ** Math.max(0, notification.attempts - 1))),
          errorMessage: lastError,
          lastError,
        },
      });
      this.logger.warn(`Notification ${notification.id} failed: ${lastError}`);
    }
  }

  private text(
    type: NotificationType,
    appointment: {
      startsAt: Date;
      cancellationReason: string | null;
      company: { name: string; timezone: string; currency: string };
      employee: { firstName: string; lastName: string | null };
      service: { name: string };
      priceSnapshot: Prisma.Decimal;
    },
  ): string {
    const date = new Intl.DateTimeFormat('ru-RU', {
      timeZone: appointment.company.timezone,
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(appointment.startsAt);
    const employee = [appointment.employee.firstName, appointment.employee.lastName]
      .filter(Boolean)
      .join(' ');
    const headings: Record<NotificationType, string> = {
      APPOINTMENT_CREATED: 'Запись подтверждена ✅',
      APPOINTMENT_REMINDER: 'Напоминаем о записи 🔔',
      APPOINTMENT_CHANGED: 'Запись изменена',
      APPOINTMENT_CANCELLED: 'Запись отменена ❌',
      REBOOK_OFFER: 'Пора записаться снова ✨',
      WAITLIST_SLOT: 'Появилось свободное окно ✨',
    };
    return [
      headings[type],
      `Компания: ${appointment.company.name}`,
      `Услуга: ${appointment.service.name}`,
      `Специалист: ${employee}`,
      `Дата и время: ${date}`,
      `Стоимость: ${appointment.priceSnapshot.toFixed(2)} ${appointment.company.currency.trim()}`,
      appointment.cancellationReason ? `Причина: ${appointment.cancellationReason}` : null,
    ].filter((line): line is string => Boolean(line)).join('\n');
  }

  private cancel(id: string, companyId: string, reason: string) {
    return this.prisma.notification.update({
      where: { id_companyId: { id, companyId } },
      data: { status: NotificationStatus.CANCELLED, lastError: reason },
    });
  }
}
