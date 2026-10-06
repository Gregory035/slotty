import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, NotificationType, WaitlistStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { dateInTimeZone, dateOnlyToUtc } from '../scheduling/time-zone.util';
import type { TelegramCustomerInput } from '../appointments/appointments.service';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  async joinFromTelegram(companyId: string, customerInput: TelegramCustomerInput, employeeId: string, serviceId: string, desiredDate: string): Promise<void> {
    const customer = await this.prisma.customer.upsert({
      where: { companyId_telegramId: { companyId, telegramId: BigInt(customerInput.telegramId) } },
      update: { username: customerInput.username, firstName: customerInput.firstName.trim() || 'Клиент Telegram', lastName: customerInput.lastName, lastActivityAt: new Date() },
      create: { companyId, telegramId: BigInt(customerInput.telegramId), username: customerInput.username, firstName: customerInput.firstName.trim() || 'Клиент Telegram', lastName: customerInput.lastName },
    });
    const assignment = await this.prisma.employeeService.findUnique({ where: { companyId_employeeId_serviceId: { companyId, employeeId, serviceId } }, select: { employeeId: true } });
    if (!assignment) throw new NotFoundException('Employee service assignment not found');
    await this.prisma.waitlistEntry.upsert({
      where: { companyId_customerId_employeeId_serviceId_desiredDate: { companyId, customerId: customer.id, employeeId, serviceId, desiredDate: dateOnlyToUtc(desiredDate) } },
      update: { status: WaitlistStatus.WAITING, offeredAt: null, expiresAt: null, offeredAppointmentId: null },
      create: { companyId, customerId: customer.id, employeeId, serviceId, desiredDate: dateOnlyToUtc(desiredDate) },
    });
  }

  async offerForCancelledAppointment(companyId: string, appointmentId: string): Promise<void> {
    const appointment = await this.prisma.appointment.findFirst({ where: { id: appointmentId, companyId }, include: { company: { select: { timezone: true } } } });
    if (
      !appointment ||
      (appointment.status !== AppointmentStatus.CANCELLED_BY_COMPANY &&
        appointment.status !== AppointmentStatus.CANCELLED_BY_CUSTOMER) ||
      appointment.startsAt <= new Date()
    ) return;
    const alreadyOffered = await this.prisma.waitlistEntry.count({
      where: { companyId, offeredAppointmentId: appointmentId, status: WaitlistStatus.OFFERED },
    });
    if (alreadyOffered) return;
    const occupied = await this.prisma.appointment.count({
      where: {
        companyId,
        employeeId: appointment.employeeId,
        id: { not: appointment.id },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        startsAt: { lt: appointment.endsAt },
        endsAt: { gt: appointment.startsAt },
      },
    });
    if (occupied) return;
    const desiredDate = dateOnlyToUtc(dateInTimeZone(appointment.startsAt, appointment.company.timezone));
    const entry = await this.prisma.waitlistEntry.findFirst({ where: { companyId, employeeId: appointment.employeeId, serviceId: appointment.serviceId, desiredDate, status: WaitlistStatus.WAITING }, orderBy: { createdAt: 'asc' } });
    if (!entry) return;
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.waitlistEntry.updateMany({
        where: { id: entry.id, companyId, status: WaitlistStatus.WAITING },
        data: {
          status: WaitlistStatus.OFFERED,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60_000),
          offeredAppointmentId: appointmentId,
        },
      });
      if (!claimed.count) return;
      await tx.notification.upsert({
        where: { companyId_idempotencyKey: { companyId, idempotencyKey: `waitlist:${entry.id}:offer:${appointmentId}` } },
        update: {
          status: 'PENDING',
          attempts: 0,
          scheduledAt: new Date(),
          sentAt: null,
          errorMessage: null,
          lastError: null,
        },
        create: {
          companyId,
          customerId: entry.customerId,
          appointmentId,
          type: NotificationType.WAITLIST_SLOT,
          scheduledAt: new Date(),
          idempotencyKey: `waitlist:${entry.id}:offer:${appointmentId}`,
        },
      });
    });
  }

  async sweepExpiredOffers(): Promise<number> {
    const expired = await this.prisma.waitlistEntry.findMany({
      where: {
        status: WaitlistStatus.OFFERED,
        expiresAt: { lte: new Date() },
        offeredAppointmentId: { not: null },
      },
      select: { id: true, companyId: true, offeredAppointmentId: true },
      orderBy: { expiresAt: 'asc' },
      take: 50,
    });
    let processed = 0;
    for (const entry of expired) {
      const updated = await this.prisma.waitlistEntry.updateMany({
        where: { id: entry.id, companyId: entry.companyId, status: WaitlistStatus.OFFERED, expiresAt: { lte: new Date() } },
        data: { status: WaitlistStatus.EXPIRED },
      });
      if (!updated.count || !entry.offeredAppointmentId) continue;
      processed += 1;
      try {
        await this.offerForCancelledAppointment(entry.companyId, entry.offeredAppointmentId);
      } catch (error) {
        await this.prisma.waitlistEntry.updateMany({
          where: { id: entry.id, companyId: entry.companyId, status: WaitlistStatus.EXPIRED },
          data: { status: WaitlistStatus.OFFERED },
        });
        throw error;
      }
    }
    return processed;
  }
}
