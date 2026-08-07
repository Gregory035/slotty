import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentSource,
  AppointmentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { localDateTimeToUtc } from '../scheduling/time-zone.util';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

const appointmentInclude = {
  customer: true,
  employee: true,
  service: true,
  company: { select: { timezone: true, currency: true } },
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
  currency: string;
  timezone: string;
}

const CANCELLED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_COMPANY,
  AppointmentStatus.CANCELLED_BY_CUSTOMER,
];

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
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

    const requestedStart = localDateTimeToUtc(date, time, company.timezone);
    const availability = await this.scheduling.getAvailability(companyId, {
      employeeId,
      serviceId,
      date,
      stepMinutes: 15,
    });
    const slot = availability.slots.find(
      ({ startsAt }) => startsAt === requestedStart.toISOString(),
    );
    if (!slot) throw new ConflictException('Selected slot is no longer available');
    const requestedEnd = new Date(slot.endsAt);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const customer = await transaction.customer.upsert({
              where: {
                companyId_telegramId: {
                  companyId,
                  telegramId: BigInt(customerInput.telegramId),
                },
              },
              update: {
                username: customerInput.username,
                firstName: customerInput.firstName,
                lastName: customerInput.lastName,
                lastActivityAt: new Date(),
              },
              create: {
                companyId,
                telegramId: BigInt(customerInput.telegramId),
                username: customerInput.username,
                firstName: customerInput.firstName,
                lastName: customerInput.lastName,
              },
            });
            if (customer.isBlacklisted) {
              throw new ForbiddenException('Customer is blacklisted');
            }

            const service = await transaction.service.findFirst({
              where: {
                id: serviceId,
                companyId,
                isActive: true,
                deletedAt: null,
              },
            });
            const employee = await transaction.employee.findFirst({
              where: {
                id: employeeId,
                companyId,
                isActive: true,
                deletedAt: null,
              },
            });
            const bookingCompany = await transaction.company.findUnique({
              where: { id: companyId },
              select: { timezone: true, currency: true },
            });
            if (!service) throw new NotFoundException('Service not found');
            if (!employee) throw new NotFoundException('Employee not found');
            if (!bookingCompany) throw new NotFoundException('Company not found');

            const overlap = await transaction.appointment.findFirst({
              where: {
                companyId,
                employeeId,
                startsAt: { lt: requestedEnd },
                endsAt: { gt: requestedStart },
                status: { notIn: CANCELLED_STATUSES },
              },
              select: { id: true },
            });
            if (overlap) {
              throw new ConflictException('Selected slot is no longer available');
            }

            const appointment = await transaction.appointment.create({
              data: {
                companyId,
                customerId: customer.id,
                employeeId,
                serviceId,
                startsAt: requestedStart,
                endsAt: requestedEnd,
                status: AppointmentStatus.CONFIRMED,
                source: AppointmentSource.TELEGRAM,
                priceSnapshot: service.price,
              },
            });
            const employeeName = [employee.firstName, employee.lastName]
              .filter(Boolean)
              .join(' ');
            return {
              appointmentId: appointment.id,
              startsAt: appointment.startsAt,
              endsAt: appointment.endsAt,
              serviceName: service.name,
              employeeName,
              price: service.price.toFixed(2),
              currency: bookingCompany.currency.trim(),
              timezone: bookingCompany.timezone,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Selected slot is no longer available');
  }

  async findAll(
    companyId: string,
    query: AppointmentQueryDto,
  ): Promise<AppointmentResponseDto[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to
          ? {
              startsAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: appointmentInclude,
      orderBy: { startsAt: 'asc' },
      take: 200,
    });
    return appointments.map((appointment) => this.toResponse(appointment));
  }

  async updateStatus(
    companyId: string,
    appointmentId: string,
    input: UpdateAppointmentStatusDto,
  ): Promise<AppointmentResponseDto> {
    const current = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId },
      select: { id: true, status: true },
    });
    if (!current) throw new NotFoundException('Appointment not found');
    const isCancelled = CANCELLED_STATUSES.includes(input.status);
    if (CANCELLED_STATUSES.includes(current.status) && !isCancelled) {
      throw new BadRequestException('Cancelled appointment cannot be reopened');
    }
    const appointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: input.status,
        cancellationReason: isCancelled
          ? input.cancellationReason?.trim() || null
          : null,
      },
      include: appointmentInclude,
    });
    return this.toResponse(appointment);
  }

  private toResponse(
    appointment: AppointmentWithRelations,
  ): AppointmentResponseDto {
    return {
      id: appointment.id,
      companyId: appointment.companyId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      source: appointment.source,
      price: appointment.priceSnapshot.toFixed(2),
      notes: appointment.notes,
      cancellationReason: appointment.cancellationReason,
      customer: {
        id: appointment.customer.id,
        telegramId: appointment.customer.telegramId.toString(),
        firstName: appointment.customer.firstName,
        lastName: appointment.customer.lastName,
        username: appointment.customer.username,
        phone: appointment.customer.phone,
      },
      employee: {
        id: appointment.employee.id,
        firstName: appointment.employee.firstName,
        lastName: appointment.employee.lastName,
      },
      service: {
        id: appointment.service.id,
        name: appointment.service.name,
        durationMinutes: appointment.service.durationMinutes,
      },
      timezone: appointment.company.timezone,
      currency: appointment.company.currency.trim(),
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    };
  }
}
