import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentHistoryAction,
  AppointmentSource,
  AppointmentStatus,
  BotStatus,
  CompanyRole,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { DepositStatus } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { CompanyMembershipContext } from '../companies/company-access.types';
import { CursorPage, decodeCursor, pageFromRows } from '../common/pagination';
import { PrismaService } from '../database/prisma.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { dateInTimeZone, dateOnlyToUtc, localDateTimeToUtc } from '../scheduling/time-zone.util';
import { TelegramApiService } from '../telegram/telegram-api.service';
import { encodeUuid } from '../telegram/callback-data.util';
import { TokenEncryptionService } from '../telegram/token-encryption.service';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { CreateAppointmentDto, RescheduleAppointmentDto } from './dto/create-appointment.dto';
import { EntitlementsService } from '../billing/entitlements.service';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { assertAppointmentTransition } from './appointment-state-machine';

const appointmentInclude = {
  customer: true,
  employee: true,
  service: true,
  company: { select: { name: true, timezone: true, currency: true } },
  review: true,
} satisfies Prisma.AppointmentInclude;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

export interface TelegramCustomerInput {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
}

export interface TelegramBookingResult {
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
  employeeName: string;
  price: string;
  depositAmount: string;
  depositStatus: DepositStatus;
  currency: string;
  timezone: string;
}

interface CreateBookingInput {
  companyId: string;
  customerId: string;
  employeeId: string;
  serviceId: string;
  requestedStart: Date;
  source: AppointmentSource;
  notes?: string;
  actorId?: string;
  idempotencyKey?: string;
  excludeAppointmentId?: string;
}

const CANCELLED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_COMPANY,
  AppointmentStatus.CANCELLED_BY_CUSTOMER,
];

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly encryption: TokenEncryptionService,
    private readonly telegramApi: TelegramApiService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async createFromTelegram(
    companyId: string,
    customerInput: TelegramCustomerInput,
    employeeId: string,
    serviceId: string,
    date: string,
    time: string,
  ): Promise<TelegramBookingResult> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { timezone: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    const firstName = this.telegramCustomerName(customerInput);
    const customer = await this.prisma.customer.upsert({
      where: {
        companyId_telegramId: {
          companyId,
          telegramId: BigInt(customerInput.telegramId),
        },
      },
      update: {
        username: customerInput.username,
        firstName,
        lastName: customerInput.lastName,
        lastActivityAt: new Date(),
      },
      create: {
        companyId,
        telegramId: BigInt(customerInput.telegramId),
        username: customerInput.username,
        firstName,
        lastName: customerInput.lastName,
      },
    });
    const appointment = await this.createBooking({
      companyId,
      customerId: customer.id,
      employeeId,
      serviceId,
      requestedStart: localDateTimeToUtc(date, time, company.timezone),
      source: AppointmentSource.TELEGRAM,
      idempotencyKey: `telegram:${customer.id}:${employeeId}:${serviceId}:${date}:${time}`,
    });
    return {
      appointmentId: appointment.id,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      serviceName: appointment.service.name,
      employeeName: [appointment.employee.firstName, appointment.employee.lastName]
        .filter(Boolean)
        .join(' '),
      price: appointment.priceSnapshot.toFixed(2),
      depositAmount: appointment.depositAmountSnapshot.toFixed(2),
      depositStatus: appointment.depositStatus,
      currency: appointment.company.currency.trim(),
      timezone: appointment.company.timezone,
    };
  }

  async createFromDashboard(
    companyId: string,
    input: CreateAppointmentDto,
    actorId: string,
    idempotencyKey?: string,
  ): Promise<AppointmentResponseDto> {
    if (idempotencyKey && idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency key is too long');
    }
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(companyId, idempotencyKey);
      if (existing) return this.toResponse(existing);
    }
    const customerId = input.customerId ?? (await this.createManualCustomer(companyId, input)).id;
    const appointment = await this.createBooking({
      companyId,
      customerId,
      employeeId: input.employeeId,
      serviceId: input.serviceId,
      requestedStart: new Date(input.startsAt),
      source: AppointmentSource.DASHBOARD,
      notes: input.notes,
      actorId,
      idempotencyKey,
    });
    return this.toResponse(appointment);
  }

  async history(companyId: string, appointmentId: string) {
    const exists = await this.prisma.appointment.findUnique({
      where: { id_companyId: { id: appointmentId, companyId } },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Appointment not found');
    return this.prisma.appointmentHistory.findMany({
      where: { companyId, appointmentId },
      include: {
        actor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async findAll(
    companyId: string,
    query: AppointmentQueryDto,
    membership?: CompanyMembershipContext,
  ): Promise<CursorPage<AppointmentResponseDto>> {
    const scopedEmployeeId =
      membership?.role === CompanyRole.EMPLOYEE
        ? membership.employeeId
        : query.employeeId;
    if (membership?.role === CompanyRole.EMPLOYEE && !scopedEmployeeId) {
      throw new ForbiddenException('Employee profile is not linked');
    }
    const cursor = decodeCursor(query.cursor);
    const conditions: Prisma.AppointmentWhereInput[] = [];
    if (query.search?.trim()) {
      const search = query.search.trim();
      conditions.push({
        OR: [
          { customer: { firstName: { contains: search, mode: 'insensitive' } } },
          { customer: { lastName: { contains: search, mode: 'insensitive' } } },
          { customer: { username: { contains: search, mode: 'insensitive' } } },
          { customer: { phone: { contains: search, mode: 'insensitive' } } },
          { service: { name: { contains: search, mode: 'insensitive' } } },
          { employee: { firstName: { contains: search, mode: 'insensitive' } } },
          { employee: { lastName: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    if (cursor) {
      const cursorDate = new Date(cursor.date);
      conditions.push({
        OR: [
          query.order === 'desc'
            ? { startsAt: { lt: cursorDate } }
            : { startsAt: { gt: cursorDate } },
          {
            startsAt: cursorDate,
            id: query.order === 'desc' ? { lt: cursor.id } : { gt: cursor.id },
          },
        ],
      });
    }
    const order = query.order ?? 'asc';
    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.source ? { source: query.source } : {}),
        ...(query.from || query.to
          ? {
              startsAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
        ...(conditions.length ? { AND: conditions } : {}),
      },
      include: appointmentInclude,
      orderBy: [{ startsAt: order }, { id: order }],
      take: query.limit + 1,
    });
    const mapped = appointments.map((appointment) =>
      this.toResponse(appointment, membership?.role === CompanyRole.EMPLOYEE),
    );
    return pageFromRows(mapped, query.limit, (appointment) => ({
      date: appointment.startsAt.toISOString(),
      id: appointment.id,
    }));
  }

  async reschedule(
    companyId: string,
    appointmentId: string,
    input: RescheduleAppointmentDto,
    actorId?: string,
  ): Promise<AppointmentResponseDto> {
    const current = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId },
      include: appointmentInclude,
    });
    if (!current) throw new NotFoundException('Appointment not found');
    if (
      ([
        AppointmentStatus.COMPLETED,
        AppointmentStatus.NO_SHOW,
        AppointmentStatus.CANCELLED_BY_COMPANY,
        AppointmentStatus.CANCELLED_BY_CUSTOMER,
      ] as AppointmentStatus[]).includes(current.status)
    ) {
      throw new ConflictException('Finished or cancelled appointment cannot be rescheduled');
    }
    const employeeId = input.employeeId ?? current.employeeId;
    const serviceId = input.serviceId ?? current.serviceId;
    const requestedStart = new Date(input.startsAt);
    const slot = await this.requireAvailableSlot(
      companyId,
      employeeId,
      serviceId,
      requestedStart,
      appointmentId,
    );
    try {
      const appointment = await this.prisma.$transaction(
        async (tx) => {
          const assignment = await tx.employeeService.findUnique({
            where: {
              companyId_employeeId_serviceId: { companyId, employeeId, serviceId },
            },
            include: { employee: true, service: true },
          });
          if (!assignment || !assignment.employee.isActive || !assignment.service.isActive) {
            throw new NotFoundException('Employee service assignment not found');
          }
          const changed = await tx.appointment.updateMany({
            where: {
              id: appointmentId,
              companyId,
              startsAt: current.startsAt,
              endsAt: current.endsAt,
              status: current.status,
            },
            data: {
              employeeId,
              serviceId,
              startsAt: requestedStart,
              endsAt: new Date(slot.endsAt),
              durationMinutesSnapshot:
                assignment.durationMinutes ?? assignment.service.durationMinutes,
              priceSnapshot: assignment.price ?? assignment.service.price,
              ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
            },
          });
          if (changed.count !== 1) {
            throw new ConflictException('Appointment was changed concurrently');
          }
          await tx.appointmentHistory.create({
            data: {
              companyId,
              appointmentId,
              actorId,
              action: AppointmentHistoryAction.RESCHEDULED,
              previousStartsAt: current.startsAt,
              previousEndsAt: current.endsAt,
              nextStartsAt: requestedStart,
              nextEndsAt: new Date(slot.endsAt),
            },
          });
          if (actorId) {
            await tx.auditLog.create({
              data: {
                companyId,
                actorId,
                action: 'appointment.rescheduled',
                entityType: 'Appointment',
                entityId: appointmentId,
                metadata: {
                  previousStartsAt: current.startsAt.toISOString(),
                  nextStartsAt: requestedStart.toISOString(),
                },
              },
            });
          }
          await tx.outboxEvent.create({
            data: {
              companyId,
              type: 'appointment.rescheduled',
              aggregateType: 'Appointment',
              aggregateId: appointmentId,
              payload: { appointmentId },
              idempotencyKey: `appointment:${appointmentId}:rescheduled:${randomUUID()}`,
            },
          });
          await tx.notification.updateMany({
            where: {
              companyId,
              appointmentId,
              status: { in: [NotificationStatus.PENDING, NotificationStatus.PROCESSING] },
            },
            data: { status: NotificationStatus.CANCELLED },
          });
          const result = await tx.appointment.findUnique({
            where: { id_companyId: { id: appointmentId, companyId } },
            include: appointmentInclude,
          });
          if (!result) throw new NotFoundException('Appointment not found');
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.toResponse(appointment);
    } catch (error) {
      this.rethrowBookingConflict(error);
    }
  }

  async updateStatus(
    companyId: string,
    appointmentId: string,
    input: UpdateAppointmentStatusDto,
    membership?: CompanyMembershipContext,
    actorId?: string,
  ): Promise<AppointmentResponseDto> {
    const current = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId },
      select: { id: true, status: true, employeeId: true },
    });
    if (!current) throw new NotFoundException('Appointment not found');
    if (
      membership?.role === CompanyRole.EMPLOYEE &&
      membership.employeeId !== current.employeeId
    ) {
      throw new ForbiddenException('Employee can update only own appointments');
    }
    assertAppointmentTransition(current.status, input.status);
    const isCancelled = CANCELLED_STATUSES.includes(input.status);
    const now = new Date();
    const appointment = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.appointment.updateMany({
        where: { id: appointmentId, companyId, status: current.status },
        data: {
          status: input.status,
          cancellationReason: isCancelled
            ? input.cancellationReason?.trim() || null
            : null,
          cancellationActor: isCancelled ? actorId ?? 'telegram-customer' : null,
          cancelledAt: isCancelled ? now : null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Appointment was changed concurrently');
      }
      await transaction.appointmentHistory.create({
        data: {
          companyId,
          appointmentId,
          actorId: actorId ?? null,
          action: AppointmentHistoryAction.STATUS_CHANGED,
          fromStatus: current.status,
          toStatus: input.status,
          reason: input.cancellationReason?.trim() || null,
        },
      });
      if (actorId) {
        await transaction.auditLog.create({
          data: {
            companyId,
            actorId,
            action: 'appointment.status_changed',
            entityType: 'Appointment',
            entityId: appointmentId,
            metadata: {
              from: current.status,
              to: input.status,
              hasReason: Boolean(input.cancellationReason?.trim()),
            },
          },
        });
      }
      await transaction.outboxEvent.create({
        data: {
          companyId,
          type: isCancelled
            ? 'appointment.cancelled'
            : 'appointment.status_changed',
          aggregateType: 'Appointment',
          aggregateId: appointmentId,
          payload: {
            appointmentId,
            status: input.status,
            customerInitiated: !actorId,
          },
          idempotencyKey: `appointment:${appointmentId}:status:${input.status}`,
        },
      });
      if (isCancelled) {
        await transaction.notification.updateMany({
          where: {
            companyId,
            appointmentId,
            status: {
              in: [
                NotificationStatus.PENDING,
                NotificationStatus.PROCESSING,
              ],
            },
          },
          data: { status: NotificationStatus.CANCELLED },
        });
      }
      const result = await transaction.appointment.findUnique({
        where: { id_companyId: { id: appointmentId, companyId } },
        include: appointmentInclude,
      });
      if (!result) throw new NotFoundException('Appointment not found');
      return result;
    });
    if (
      current.status !== AppointmentStatus.COMPLETED &&
      input.status === AppointmentStatus.COMPLETED
    ) {
      await this.notifyReviewRequest(appointment);
    }
    return this.toResponse(appointment);
  }

  async updateDepositStatus(
    companyId: string,
    appointmentId: string,
    status: 'PAID' | 'WAIVED',
    actorId: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.prisma.appointment.update({
      where: { id_companyId: { id: appointmentId, companyId } },
      data: { depositStatus: status },
      include: appointmentInclude,
    }).catch(() => { throw new NotFoundException('Appointment not found'); });
    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action: 'appointment.deposit_status_changed',
        entityType: 'Appointment',
        entityId: appointmentId,
        metadata: { status },
      },
    });
    return this.toResponse(appointment);
  }

  private async createBooking(input: CreateBookingInput): Promise<AppointmentWithRelations> {
    if (input.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(input.companyId, input.idempotencyKey);
      if (existing) return existing;
    }
    await this.entitlements.assertCanCreateAppointment(input.companyId);
    const slot = await this.requireAvailableSlot(
      input.companyId,
      input.employeeId,
      input.serviceId,
      input.requestedStart,
      input.excludeAppointmentId,
    );
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            if (input.idempotencyKey) {
              const existing = await tx.appointment.findFirst({
                where: { companyId: input.companyId, idempotencyKey: input.idempotencyKey },
                include: appointmentInclude,
              });
              if (existing) return existing;
            }
            const [customer, assignment] = await Promise.all([
              tx.customer.findUnique({
                where: { id_companyId: { id: input.customerId, companyId: input.companyId } },
              }),
              tx.employeeService.findUnique({
                where: {
                  companyId_employeeId_serviceId: {
                    companyId: input.companyId,
                    employeeId: input.employeeId,
                    serviceId: input.serviceId,
                  },
                },
                include: { employee: true, service: true },
              }),
            ]);
            if (!customer) throw new NotFoundException('Customer not found');
            if (customer.isBlacklisted) throw new ForbiddenException('Customer is blacklisted');
            if (
              !assignment ||
              !assignment.employee.isActive ||
              assignment.employee.deletedAt ||
              !assignment.service.isActive ||
              assignment.service.deletedAt
            ) {
              throw new NotFoundException('Employee service assignment not found');
            }
            const requestedEnd = new Date(slot.endsAt);
            const overlap = await tx.appointment.findFirst({
              where: {
                companyId: input.companyId,
                employeeId: input.employeeId,
                startsAt: { lt: requestedEnd },
                endsAt: { gt: input.requestedStart },
                status: { notIn: CANCELLED_STATUSES },
              },
              select: { id: true },
            });
            if (overlap) throw new ConflictException('Selected slot is no longer available');
            const priceSnapshot = assignment.price ?? assignment.service.price;
            const depositPercent = assignment.service.depositPercent;
            const appointment = await tx.appointment.create({
              data: {
                companyId: input.companyId,
                customerId: input.customerId,
                employeeId: input.employeeId,
                serviceId: input.serviceId,
                startsAt: input.requestedStart,
                endsAt: requestedEnd,
                status: AppointmentStatus.CONFIRMED,
                source: input.source,
                notes: input.notes?.trim() || null,
                priceSnapshot,
                depositAmountSnapshot: this.depositAmount(priceSnapshot, depositPercent, assignment.service.depositFixedAmount),
                depositStatus:
                  depositPercent > 0 || assignment.service.depositFixedAmount?.gt(0) ? 'PENDING' : 'NOT_REQUIRED',
                durationMinutesSnapshot:
                  assignment.durationMinutes ?? assignment.service.durationMinutes,
                idempotencyKey: input.idempotencyKey,
              },
            });
            const companyTimezone = await tx.company.findUnique({
              where: { id: input.companyId },
              select: { timezone: true },
            });
            if (companyTimezone) {
              await tx.waitlistEntry.updateMany({
                where: {
                  companyId: input.companyId,
                  customerId: input.customerId,
                  employeeId: input.employeeId,
                  serviceId: input.serviceId,
                  desiredDate: dateOnlyToUtc(dateInTimeZone(input.requestedStart, companyTimezone.timezone)),
                  status: { in: ['WAITING', 'OFFERED'] },
                },
                data: { status: 'BOOKED' },
              });
            }
            await tx.appointmentHistory.create({
              data: {
                companyId: input.companyId,
                appointmentId: appointment.id,
                actorId: input.actorId,
                action: AppointmentHistoryAction.CREATED,
                toStatus: appointment.status,
                nextStartsAt: appointment.startsAt,
                nextEndsAt: appointment.endsAt,
              },
            });
            if (input.actorId) {
              await tx.auditLog.create({
                data: {
                  companyId: input.companyId,
                  actorId: input.actorId,
                  action: 'appointment.created',
                  entityType: 'Appointment',
                  entityId: appointment.id,
                  metadata: { source: input.source },
                },
              });
            }
            await tx.outboxEvent.create({
              data: {
                companyId: input.companyId,
                type: 'appointment.created',
                aggregateType: 'Appointment',
                aggregateId: appointment.id,
                payload: { appointmentId: appointment.id, customerId: input.customerId },
                idempotencyKey: `appointment:${appointment.id}:created`,
              },
            });
            const result = await tx.appointment.findUnique({
              where: { id_companyId: { id: appointment.id, companyId: input.companyId } },
              include: appointmentInclude,
            });
            if (!result) throw new NotFoundException('Appointment not found');
            return result;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          input.idempotencyKey
        ) {
          const existing = await this.findByIdempotencyKey(input.companyId, input.idempotencyKey);
          if (existing) return existing;
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        ) {
          continue;
        }
        this.rethrowBookingConflict(error);
      }
    }
    throw new ConflictException('Selected slot is no longer available');
  }

  private async requireAvailableSlot(
    companyId: string,
    employeeId: string,
    serviceId: string,
    requestedStart: Date,
    excludeAppointmentId?: string,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { timezone: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const date = dateInTimeZone(requestedStart, company.timezone);
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: company.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(requestedStart);
    const availability = await this.scheduling.getAvailability(
      companyId,
      { employeeId, serviceId, date },
      excludeAppointmentId,
    );
    const normalized = localDateTimeToUtc(date, time, company.timezone);
    if (normalized.getTime() !== requestedStart.getTime()) {
      throw new BadRequestException('Appointment start must be aligned to a minute');
    }
    const slot = availability.slots.find((item) => item.startsAt === requestedStart.toISOString());
    if (!slot) throw new ConflictException('Selected slot is no longer available');
    return slot;
  }

  private async createManualCustomer(companyId: string, input: CreateAppointmentDto) {
    if (!input.customer) throw new BadRequestException('customerId or customer is required');
    const firstName = input.customer.firstName.trim();
    if (!firstName) throw new BadRequestException('Customer first name is required');
    return this.prisma.customer.create({
      data: {
        companyId,
        telegramId: null,
        firstName,
        lastName: input.customer.lastName?.trim() || null,
        phone: input.customer.phone?.trim() || null,
      },
    });
  }

  private telegramCustomerName(input: TelegramCustomerInput): string {
    const firstName = input.firstName.trim();
    if (/[\p{L}\p{N}]/u.test(firstName)) return firstName;
    const username = input.username?.trim().replace(/^@/, '');
    return username ? `@${username}` : 'Клиент Telegram';
  }

  private async notifyReviewRequest(
    appointment: AppointmentWithRelations,
  ): Promise<void> {
    try {
      if (!appointment.customer.telegramId || appointment.review) return;
      const bot = await this.prisma.bot.findUnique({
        where: { companyId: appointment.companyId },
        select: { tokenEncrypted: true, status: true },
      });
      if (!bot || bot.status !== BotStatus.ACTIVE) return;
      const appointmentCode = encodeUuid(appointment.id);
      const keyboard = new InlineKeyboard();
      for (let rating = 1; rating <= 5; rating += 1) {
        keyboard.text(`${rating} ★`, `v:${appointmentCode}:${rating}`);
      }
      await this.telegramApi.sendMessage(
        this.encryption.decrypt(bot.tokenEncrypted),
        appointment.customer.telegramId.toString(),
        `Как прошла услуга «${appointment.service.name}»? Оцените от 1 до 5.`,
        keyboard,
      );
    } catch (error) {
      this.logger.warn(
        `Could not request review for appointment ${appointment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private findByIdempotencyKey(companyId: string, idempotencyKey: string) {
    return this.prisma.appointment.findFirst({
      where: { companyId, idempotencyKey },
      include: appointmentInclude,
    });
  }

  private rethrowBookingConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2004', 'P2034'].includes(error.code)
    ) {
      throw new ConflictException('Selected slot is no longer available');
    }
    if (
      error instanceof Prisma.PrismaClientUnknownRequestError &&
      (error.message.includes('23P01') ||
        error.message.includes('Appointment_no_employee_overlap'))
    ) {
      throw new ConflictException('Selected slot is no longer available');
    }
    throw error;
  }

  private async notifyCancellation(
    appointment: AppointmentWithRelations,
  ): Promise<void> {
    let notificationId: string | undefined;
    try {
      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          appointmentId: appointment.id,
          type: NotificationType.APPOINTMENT_CANCELLED,
          status: NotificationStatus.SENT,
        },
        select: { id: true },
      });
      if (alreadySent) return;

      const notification = await this.prisma.notification.create({
        data: {
          companyId: appointment.companyId,
          customerId: appointment.customerId,
          appointmentId: appointment.id,
          type: NotificationType.APPOINTMENT_CANCELLED,
          status: NotificationStatus.PROCESSING,
          scheduledAt: new Date(),
          idempotencyKey: `appointment:${appointment.id}:cancelled`,
        },
        select: { id: true },
      });
      notificationId = notification.id;

      const bot = await this.prisma.bot.findUnique({
        where: { companyId: appointment.companyId },
        select: { tokenEncrypted: true, status: true },
      });
      if (!bot || bot.status !== BotStatus.ACTIVE) {
        throw new Error('Active Telegram bot is not configured');
      }
      if (!appointment.customer.telegramId) {
        throw new Error('Customer has no Telegram account');
      }

      const employeeName = [
        appointment.employee.firstName,
        appointment.employee.lastName,
      ]
        .filter(Boolean)
        .join(' ');
      const localDateTime = new Intl.DateTimeFormat('ru-RU', {
        timeZone: appointment.company.timezone,
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(appointment.startsAt);
      const message = [
        `Запись в ${appointment.company.name} отменена ❌`,
        `Услуга: ${appointment.service.name}`,
        `Специалист: ${employeeName}`,
        `Дата и время: ${localDateTime}`,
        appointment.cancellationReason
          ? `Причина: ${appointment.cancellationReason}`
          : null,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');

      await this.telegramApi.sendMessage(
        this.encryption.decrypt(bot.tokenEncrypted),
        appointment.customer.telegramId.toString(),
        message,
      );
      await this.prisma.notification.update({
        where: {
          id_companyId: {
            id: notification.id,
            companyId: appointment.companyId,
          },
        },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error';
      if (notificationId) {
        await this.prisma.notification
          .update({
            where: {
              id_companyId: {
                id: notificationId,
                companyId: appointment.companyId,
              },
            },
            data: {
              status: NotificationStatus.FAILED,
              errorMessage,
            },
          })
          .catch(() => undefined);
      }
      this.logger.warn(
        `Could not notify Telegram customer about appointment ${appointment.id}: ${errorMessage}`,
      );
    }
  }

  private toResponse(
    appointment: AppointmentWithRelations,
    redactCustomer = false,
  ): AppointmentResponseDto {
    return {
      id: appointment.id,
      companyId: appointment.companyId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      source: appointment.source,
      price: appointment.priceSnapshot.toFixed(2),
      depositAmount: appointment.depositAmountSnapshot.toFixed(2),
      depositStatus: appointment.depositStatus,
      notes: appointment.notes,
      cancellationReason: appointment.cancellationReason,
      customer: {
        id: appointment.customer.id,
        telegramId: redactCustomer
          ? null
          : appointment.customer.telegramId?.toString() ?? null,
        firstName: appointment.customer.firstName,
        lastName: appointment.customer.lastName,
        username: redactCustomer ? null : appointment.customer.username,
        phone: redactCustomer ? null : appointment.customer.phone,
      },
      employee: {
        id: appointment.employee.id,
        firstName: appointment.employee.firstName,
        lastName: appointment.employee.lastName,
      },
      service: {
        id: appointment.service.id,
        name: appointment.service.name,
        durationMinutes: appointment.durationMinutesSnapshot,
      },
      review: appointment.review
        ? {
            rating: appointment.review.rating,
            comment: appointment.review.comment,
            createdAt: appointment.review.createdAt,
          }
        : null,
      timezone: appointment.company.timezone,
      currency: appointment.company.currency.trim(),
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    };
  }

  private depositAmount(price: Prisma.Decimal, percent: number, fixed?: Prisma.Decimal | null): Prisma.Decimal {
    if (fixed?.gt(0)) return (fixed.gt(price) ? price : fixed).toDecimalPlaces(2);
    if (percent <= 0) return new Prisma.Decimal(0);
    return price.mul(percent).div(100).toDecimalPlaces(2);
  }
}
