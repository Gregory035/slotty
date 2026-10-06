import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  AppointmentStatus,
  BotStatus,
  Notification,
  NotificationStatus,
  NotificationType,
  Prisma,
  WaitlistStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InlineKeyboard } from 'grammy';
import { encodeUuid } from '../telegram/callback-data.util';
import { TelegramApiService } from '../telegram/telegram-api.service';
import { TokenEncryptionService } from '../telegram/token-encryption.service';

const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 5 * 60_000;
const RECOVERY_INTERVAL_MS = 60_000;

@Injectable()
export class NotificationWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastRecovery = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
    private readonly telegram: TelegramApiService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.tick().catch((error: unknown) => {
        this.logger.error('Notification worker tick failed', error);
      });
    }, 500);
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
        await this.prisma.notification.updateMany({
          where: {
            status: NotificationStatus.PROCESSING,
            attempts: { gte: MAX_ATTEMPTS },
            updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) },
          },
          data: { status: NotificationStatus.FAILED, lastError: 'Worker stopped before delivery completed' },
        });
      }
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
        WHERE (
          ("status" = 'PENDING' AND "scheduledAt" <= NOW())
          OR ("status" = 'PROCESSING' AND "updatedAt" < ${new Date(Date.now() - STALE_PROCESSING_MS)})
        )
        AND "attempts" < ${MAX_ATTEMPTS}
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
      if (record.type === NotificationType.WAITLIST_SLOT) {
        const activeOffer = await this.prisma.waitlistEntry.findFirst({
          where: {
            companyId: record.companyId,
            customerId: record.customerId,
            offeredAppointmentId: record.appointmentId,
            status: WaitlistStatus.OFFERED,
            expiresAt: { gt: new Date() },
          }, select: { id: true },
        });
        if (!activeOffer) {
          await this.cancel(record.id, record.companyId, 'Waitlist offer is no longer valid');
          return;
        }
      }
      if (record.appointment &&
        (record.type === NotificationType.APPOINTMENT_CREATED || record.type === NotificationType.APPOINTMENT_REMINDER || record.type === NotificationType.APPOINTMENT_CHANGED) &&
        (record.appointment.status === AppointmentStatus.CANCELLED_BY_COMPANY || record.appointment.status === AppointmentStatus.CANCELLED_BY_CUSTOMER)) {
        await this.cancel(record.id, record.companyId, 'Appointment is cancelled');
        return;
      }
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
      type !== NotificationType.WAITLIST_SLOT && appointment.cancellationReason
        ? `Причина: ${appointment.cancellationReason}`
        : null,
    ].filter((line): line is string => Boolean(line)).join('\n');
  }

  private cancel(id: string, companyId: string, reason: string) {
    return this.prisma.notification.update({
      where: { id_companyId: { id, companyId } },
      data: { status: NotificationStatus.CANCELLED, lastError: reason },
    });
  }
}
