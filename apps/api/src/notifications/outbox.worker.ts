import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  AppointmentSource,
  NotificationStatus,
  NotificationType,
  OutboxEvent,
  OutboxStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { WaitlistService } from '../waitlist/waitlist.service';

const MAX_ATTEMPTS = 5;

@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly waitlist: WaitlistService,
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
        const event = await this.claim();
        if (!event) break;
        await this.process(event);
      }
    } finally {
      this.running = false;
    }
  }

  private async claim(): Promise<OutboxEvent | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "OutboxEvent"
      SET "status" = 'PROCESSING', "attempts" = "attempts" + 1, "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id" FROM "OutboxEvent"
        WHERE "status" = 'PENDING' AND "availableAt" <= NOW()
        ORDER BY "availableAt", "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id"
    `);
    if (!rows[0]) return null;
    return this.prisma.outboxEvent.findUnique({ where: { id: rows[0].id } });
  }

  private async process(event: OutboxEvent): Promise<void> {
    try {
      if (event.aggregateType === 'Appointment') {
        await this.createAppointmentNotifications(event);
        if (event.type === 'appointment.cancelled') {
          await this.waitlist.offerForCancelledAppointment(event.companyId, event.aggregateId);
        }
      }
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.PROCESSED,
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const lastError = this.message(error);
      const dead = event.attempts >= MAX_ATTEMPTS;
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: dead ? OutboxStatus.DEAD : OutboxStatus.PENDING,
          availableAt: new Date(Date.now() + this.backoff(event.attempts)),
          lastError,
        },
      });
      this.logger.warn(`Outbox event ${event.id} failed: ${lastError}`);
    }
  }

  private async createAppointmentNotifications(event: OutboxEvent): Promise<void> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: event.aggregateId, companyId: event.companyId },
      select: {
        id: true,
        companyId: true,
        customerId: true,
        startsAt: true,
        source: true,
        customer: { select: { telegramId: true } },
        company: { select: { rebookingDelayDays: true } },
      },
    });
    if (!appointment || !appointment.customer.telegramId) return;
    const type = this.notificationType(event.type);
    const payload = event.payload as { customerInitiated?: boolean; status?: string };
    const skipImmediate =
      (type === NotificationType.APPOINTMENT_CREATED &&
        appointment.source === AppointmentSource.TELEGRAM) ||
      (type === NotificationType.APPOINTMENT_CANCELLED && payload.customerInitiated) ||
      (event.type === 'appointment.status_changed' && ['COMPLETED', 'NO_SHOW'].includes(payload.status ?? ''));
    if (type && !skipImmediate) {
      await this.prisma.notification.upsert({
        where: {
          companyId_idempotencyKey: {
            companyId: event.companyId,
            idempotencyKey: `outbox:${event.id}`,
          },
        },
        update: {},
        create: {
          companyId: event.companyId,
          customerId: appointment.customerId,
          appointmentId: appointment.id,
          type,
          status: NotificationStatus.PENDING,
          scheduledAt: new Date(),
          idempotencyKey: `outbox:${event.id}`,
        },
      });
    }
    if (['appointment.created', 'appointment.rescheduled'].includes(event.type)) {
      for (const hours of [24, 2]) {
        const scheduledAt = new Date(appointment.startsAt.getTime() - hours * 60 * 60 * 1000);
        if (scheduledAt <= new Date()) continue;
        const key = `appointment:${appointment.id}:reminder:${hours}:${appointment.startsAt.toISOString()}`;
        await this.prisma.notification.upsert({
          where: {
            companyId_idempotencyKey: { companyId: event.companyId, idempotencyKey: key },
          },
          update: {},
          create: {
            companyId: event.companyId,
            customerId: appointment.customerId,
            appointmentId: appointment.id,
            type: NotificationType.APPOINTMENT_REMINDER,
            scheduledAt,
            idempotencyKey: key,
          },
        });
      }
    }
    if (event.type === 'appointment.status_changed' && payload.status === 'COMPLETED') {
      const scheduledAt = new Date(Date.now() + appointment.company.rebookingDelayDays * 86_400_000);
      const key = `appointment:${appointment.id}:rebook:${appointment.company.rebookingDelayDays}`;
      await this.prisma.notification.upsert({
        where: { companyId_idempotencyKey: { companyId: event.companyId, idempotencyKey: key } },
        update: {},
        create: {
          companyId: event.companyId,
          customerId: appointment.customerId,
          appointmentId: appointment.id,
          type: NotificationType.REBOOK_OFFER,
          scheduledAt,
          idempotencyKey: key,
        },
      });
    }
  }

  private notificationType(type: string): NotificationType | null {
    if (type === 'appointment.created') return NotificationType.APPOINTMENT_CREATED;
    if (type === 'appointment.cancelled') return NotificationType.APPOINTMENT_CANCELLED;
    if (type === 'appointment.rescheduled' || type === 'appointment.status_changed') {
      return NotificationType.APPOINTMENT_CHANGED;
    }
    return null;
  }

  private backoff(attempt: number): number {
    return Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1));
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error';
  }
}
