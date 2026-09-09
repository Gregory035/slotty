import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { CursorPage, decodeCursor, pageFromRows } from '../common/pagination';
import { PrismaService } from '../database/prisma.service';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CustomerDetailsDto, CustomerResponseDto, CustomerStatisticsDto } from './dto/customer-response.dto';
import { SetCustomerBlacklistDto, UpdateCustomerDto } from './dto/update-customer.dto';

const customerFields = {
  id: true,
  companyId: true,
  telegramId: true,
  username: true,
  firstName: true,
  lastName: true,
  phone: true,
  notes: true,
  isBlacklisted: true,
  anonymizedAt: true,
  createdAt: true,
  lastActivityAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

type CustomerRow = Prisma.CustomerGetPayload<{ select: typeof customerFields }>;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, query: CustomerQueryDto): Promise<CursorPage<CustomerResponseDto>> {
    const cursor = decodeCursor(query.cursor);
    const search = query.search?.trim();
    const conditions: Prisma.CustomerWhereInput[] = [];
    if (search) {
      conditions.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (cursor) {
      conditions.push({
        OR: [
          { lastActivityAt: { lt: new Date(cursor.date) } },
          { lastActivityAt: new Date(cursor.date), id: { lt: cursor.id } },
        ],
      });
    }
    const customers = await this.prisma.customer.findMany({
      where: {
        companyId,
        ...(conditions.length ? { AND: conditions } : {}),
      },
      select: customerFields,
      orderBy: [{ lastActivityAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const stats = await this.statistics(companyId, customers.map((item) => item.id));
    const mapped = customers.map((customer) => this.toResponse(customer, stats.get(customer.id)));
    return pageFromRows(mapped, query.limit, (customer) => ({
      date: customer.lastActivityAt.toISOString(),
      id: customer.id,
    }));
  }

  async findOne(companyId: string, customerId: string): Promise<CustomerDetailsDto> {
    const customer = await this.requireCustomer(companyId, customerId);
    const [stats, appointments] = await Promise.all([
      this.statistics(companyId, [customerId]),
      this.prisma.appointment.findMany({
        where: { companyId, customerId },
        include: { service: true, employee: true },
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
    ]);
    const mapAppointment = (appointment: (typeof appointments)[number]) => ({
      id: appointment.id,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      price: appointment.priceSnapshot.toFixed(2),
      service: { id: appointment.service.id, name: appointment.service.name },
      employee: {
        id: appointment.employee.id,
        firstName: appointment.employee.firstName,
        lastName: appointment.employee.lastName,
      },
    });
    const completed = appointments.filter((appointment) => appointment.status === AppointmentStatus.COMPLETED);
    const favoriteService = this.favorite(completed.map((appointment) => ({ id: appointment.service.id, name: appointment.service.name })));
    const favoriteEmployee = this.favorite(completed.map((appointment) => ({
      id: appointment.employee.id,
      name: [appointment.employee.firstName, appointment.employee.lastName].filter(Boolean).join(' '),
    })));
    return {
      ...this.toResponse(customer, stats.get(customerId)),
      upcomingAppointments: appointments
        .filter((appointment) => appointment.startsAt >= new Date() && ([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] as AppointmentStatus[]).includes(appointment.status))
        .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
        .map(mapAppointment),
      recentAppointments: appointments.filter((appointment) => appointment.startsAt < new Date() || !([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] as AppointmentStatus[]).includes(appointment.status)).slice(0, 25).map(mapAppointment),
      favoriteService,
      favoriteEmployee,
    };
  }

  async update(companyId: string, customerId: string, input: UpdateCustomerDto, actorId: string) {
    const current = await this.requireCustomer(companyId, customerId);
    if (current.anonymizedAt) throw new BadRequestException('Anonymized customer cannot be edited');
    const customer = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.customer.update({
        where: { id_companyId: { id: customerId, companyId } },
        data: {
          ...(input.firstName !== undefined ? { firstName: this.required(input.firstName) } : {}),
          ...(input.lastName !== undefined ? { lastName: this.optional(input.lastName) } : {}),
          ...(input.phone !== undefined ? { phone: this.optional(input.phone) } : {}),
          ...(input.notes !== undefined ? { notes: this.optional(input.notes) } : {}),
        },
        select: customerFields,
      });
      await this.audit(tx, companyId, actorId, 'customer.updated', customerId);
      return changed;
    });
    return this.toResponse(customer);
  }

  async setBlacklist(companyId: string, customerId: string, input: SetCustomerBlacklistDto, actorId: string) {
    await this.requireCustomer(companyId, customerId);
    const customer = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.customer.update({
        where: { id_companyId: { id: customerId, companyId } },
        data: { isBlacklisted: input.blacklisted },
        select: customerFields,
      });
      await this.audit(tx, companyId, actorId, input.blacklisted ? 'customer.blacklisted' : 'customer.unblocked', customerId);
      return changed;
    });
    return this.toResponse(customer);
  }

  async anonymize(companyId: string, customerId: string, actorId: string): Promise<void> {
    await this.requireCustomer(companyId, customerId);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id_companyId: { id: customerId, companyId } },
        data: {
          telegramId: null,
          username: null,
          firstName: 'Удалённый клиент',
          lastName: null,
          phone: null,
          notes: null,
          isBlacklisted: true,
          anonymizedAt: new Date(),
        },
      });
      await this.audit(tx, companyId, actorId, 'customer.personal_data_anonymized', customerId);
    });
  }

  private async requireCustomer(companyId: string, customerId: string): Promise<CustomerRow> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: customerFields,
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  private async statistics(companyId: string, ids: string[]): Promise<Map<string, CustomerStatisticsDto>> {
    const result = new Map<string, CustomerStatisticsDto>();
    if (!ids.length) return result;
    const [groups, reviewGroups] = await Promise.all([this.prisma.appointment.groupBy({
      by: ['customerId', 'status'],
      where: { companyId, customerId: { in: ids } },
      _count: { _all: true },
      _sum: { priceSnapshot: true },
    }), this.prisma.review.groupBy({
      by: ['customerId'],
      where: { companyId, customerId: { in: ids } },
      _avg: { rating: true },
      _count: { _all: true },
    })]);
    for (const row of groups) {
      const current = result.get(row.customerId) ?? {
        appointments: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        revenue: '0.00',
        averageRating: null,
        reviewsCount: 0,
      };
      current.appointments += row._count._all;
      if (row.status === AppointmentStatus.COMPLETED) {
        current.completed += row._count._all;
        current.revenue = row._sum.priceSnapshot?.toFixed(2) ?? '0.00';
      }
      if (([AppointmentStatus.CANCELLED_BY_COMPANY, AppointmentStatus.CANCELLED_BY_CUSTOMER] as AppointmentStatus[]).includes(row.status)) {
        current.cancelled += row._count._all;
      }
      if (row.status === AppointmentStatus.NO_SHOW) current.noShow += row._count._all;
      result.set(row.customerId, current);
    }
    for (const row of reviewGroups) {
      const current = result.get(row.customerId) ?? {
        appointments: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        revenue: '0.00',
        averageRating: null,
        reviewsCount: 0,
      };
      current.averageRating = row._avg.rating === null ? null : Number(row._avg.rating.toFixed(1));
      current.reviewsCount = row._count._all;
      result.set(row.customerId, current);
    }
    return result;
  }

  private toResponse(customer: CustomerRow, statistics?: CustomerStatisticsDto): CustomerResponseDto {
    return {
      ...customer,
      telegramId: customer.telegramId?.toString() ?? null,
      statistics: statistics ?? { appointments: 0, completed: 0, cancelled: 0, noShow: 0, revenue: '0.00', averageRating: null, reviewsCount: 0 },
    };
  }

  private favorite(items: Array<{ id: string; name: string }>): { id: string; name: string; count: number } | null {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    for (const item of items) {
      const current = counts.get(item.id) ?? { ...item, count: 0 };
      current.count += 1;
      counts.set(item.id, current);
    }
    return [...counts.values()].sort((left, right) => right.count - left.count)[0] ?? null;
  }

  private required(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException('Value cannot be empty');
    return trimmed;
  }

  private optional(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private audit(
    tx: Prisma.TransactionClient,
    companyId: string,
    actorId: string,
    action: string,
    entityId: string,
  ) {
    return tx.auditLog.create({
      data: { companyId, actorId, action, entityType: 'Customer', entityId },
    });
  }
}
