import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, WaitlistStatus } from '@prisma/client';
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
      update: { status: WaitlistStatus.WAITING, offeredAt: null, expiresAt: null },
      create: { companyId, customerId: customer.id, employeeId, serviceId, desiredDate: dateOnlyToUtc(desiredDate) },
    });
  }

  async offerForCancelledAppointment(companyId: string, appointmentId: string): Promise<void> {
    const appointment = await this.prisma.appointment.findFirst({ where: { id: appointmentId, companyId }, include: { company: { select: { timezone: true } } } });
    if (!appointment) return;
    const desiredDate = dateOnlyToUtc(dateInTimeZone(appointment.startsAt, appointment.company.timezone));
    const entry = await this.prisma.waitlistEntry.findFirst({ where: { companyId, employeeId: appointment.employeeId, serviceId: appointment.serviceId, desiredDate, status: WaitlistStatus.WAITING }, orderBy: { createdAt: 'asc' } });
    if (!entry) return;
    const claimed = await this.prisma.waitlistEntry.updateMany({ where: { id: entry.id, companyId, status: WaitlistStatus.WAITING }, data: { status: WaitlistStatus.OFFERED, offeredAt: new Date(), expiresAt: new Date(Date.now() + 30 * 60_000) } });
    if (!claimed.count) return;
    await this.prisma.notification.create({ data: { companyId, customerId: entry.customerId, appointmentId, type: NotificationType.WAITLIST_SLOT, scheduledAt: new Date(), idempotencyKey: `waitlist:${entry.id}:offer:${appointmentId}` } });
  }
}
