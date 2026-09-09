import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentSource, AppointmentStatus, BotStatus, ScheduleExceptionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  addDays,
  dateInTimeZone,
  dateOnlyToUtc,
  isoWeekday,
  localDateTimeToUtc,
  parseDateOnly,
  parseTimeToMinutes,
} from '../scheduling/time-zone.util';

export interface DashboardQuery {
  from?: string;
  to?: string;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string, query: DashboardQuery) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { timezone: true, currency: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const today = dateInTimeZone(new Date(), company.timezone);
    const fromDate = query.from ?? today;
    const toDate = query.to ?? today;
    parseDateOnly(fromDate);
    parseDateOnly(toDate);
    if (fromDate > toDate) throw new BadRequestException('from must not be after to');
    const periodStart = localDateTimeToUtc(fromDate, '00:00', company.timezone);
    const periodEnd = localDateTimeToUtc(addDays(toDate, 1), '00:00', company.timezone);
    const todayStart = localDateTimeToUtc(today, '00:00', company.timezone);
    const todayEnd = localDateTimeToUtc(addDays(today, 1), '00:00', company.timezone);
    const activeStatuses = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
    ];
    const [
      todayAppointments,
      cancelled,
      expected,
      actual,
      activeServices,
      activeEmployees,
      upcoming,
      bot,
      booked,
      scheduleRules,
      exceptions,
      analyticsAppointments,
      customers,
      waitlistCount,
      hasAppointment,
      telegramUpdates,
    ] = await Promise.all([
      this.prisma.appointment.count({
        where: { companyId, startsAt: { gte: todayStart, lt: todayEnd } },
      }),
      this.prisma.appointment.count({
        where: {
          companyId,
          startsAt: { gte: periodStart, lt: periodEnd },
          status: { in: [AppointmentStatus.CANCELLED_BY_COMPANY, AppointmentStatus.CANCELLED_BY_CUSTOMER] },
        },
      }),
      this.prisma.appointment.aggregate({
        where: {
          companyId,
          startsAt: { gte: periodStart, lt: periodEnd },
          status: { in: activeStatuses },
        },
        _sum: { priceSnapshot: true },
      }),
      this.prisma.appointment.aggregate({
        where: {
          companyId,
          startsAt: { gte: periodStart, lt: periodEnd },
          status: AppointmentStatus.COMPLETED,
        },
        _sum: { priceSnapshot: true },
      }),
      this.prisma.service.count({ where: { companyId, isActive: true, deletedAt: null } }),
      this.prisma.employee.count({ where: { companyId, isActive: true, deletedAt: null } }),
      this.prisma.appointment.findMany({
        where: {
          companyId,
          startsAt: { gte: new Date() },
          status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        },
        include: { customer: true, employee: true, service: true },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: 5,
      }),
      this.prisma.bot.findUnique({
        where: { companyId },
        select: { id: true, username: true, status: true, errorMessage: true },
      }),
      this.prisma.appointment.aggregate({
        where: {
          companyId,
          startsAt: { gte: periodStart, lt: periodEnd },
          status: { in: activeStatuses },
        },
        _sum: { durationMinutesSnapshot: true },
      }),
      this.prisma.scheduleRule.findMany({
        where: { companyId, isWorking: true, employee: { isActive: true, deletedAt: null } },
      }),
      this.prisma.scheduleException.findMany({
        where: {
          companyId,
          date: { gte: dateOnlyToUtc(fromDate), lte: dateOnlyToUtc(toDate) },
        },
      }),
      this.prisma.appointment.findMany({
        where: { companyId, startsAt: { gte: periodStart, lt: periodEnd } },
        select: {
          startsAt: true,
          status: true,
          source: true,
          priceSnapshot: true,
          customerId: true,
          service: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.customer.findMany({
        where: { companyId, anonymizedAt: null },
        select: { id: true, createdAt: true },
      }),
      this.prisma.waitlistEntry.count({ where: { companyId, status: 'WAITING' } }),
      this.prisma.appointment.count({ where: { companyId } }),
      this.prisma.telegramUpdate.findMany({
        where: { companyId, createdAt: { gte: periodStart, lt: periodEnd } },
        select: { payload: true },
      }),
    ]);
    const capacityMinutes = this.capacity(fromDate, toDate, scheduleRules, exceptions);
    const bookedMinutes = booked._sum.durationMinutesSnapshot ?? 0;
    return {
      period: { from: fromDate, to: toDate, timezone: company.timezone },
      currency: company.currency.trim(),
      todayAppointments,
      cancelledAppointments: cancelled,
      expectedRevenue: expected._sum.priceSnapshot?.toFixed(2) ?? '0.00',
      actualRevenue: actual._sum.priceSnapshot?.toFixed(2) ?? '0.00',
      activeServices,
      activeEmployees,
      occupancy: {
        bookedMinutes,
        capacityMinutes,
        percent: capacityMinutes ? Math.min(100, Math.round((bookedMinutes / capacityMinutes) * 100)) : 0,
      },
      bot,
      upcomingAppointments: upcoming.map((appointment) => ({
        id: appointment.id,
        startsAt: appointment.startsAt,
        status: appointment.status,
        customerName: this.customerName(appointment.customer),
        employeeName: [appointment.employee.firstName, appointment.employee.lastName].filter(Boolean).join(' '),
        serviceName: appointment.service.name,
      })),
      setupChecklist: [
        { id: 'services', label: 'Добавить услуги', done: activeServices > 0, section: 'services' },
        { id: 'employees', label: 'Добавить сотрудников', done: activeEmployees > 0, section: 'members' },
        { id: 'schedule', label: 'Настроить расписание', done: scheduleRules.length > 0, section: 'schedule' },
        { id: 'bot', label: 'Подключить Telegram-бота', done: bot?.status === BotStatus.ACTIVE, section: 'bot' },
        { id: 'test-booking', label: 'Сделать тестовую запись', done: hasAppointment > 0, section: 'appointments' },
      ],
      waitlistCount,
      analytics: this.analytics(analyticsAppointments, customers, telegramUpdates, fromDate, toDate, company.timezone),
    };
  }

  private analytics(
    appointments: Array<{
      startsAt: Date;
      status: AppointmentStatus;
      source: AppointmentSource;
      priceSnapshot: { toNumber(): number };
      customerId: string;
      service: { id: string; name: string };
      employee: { id: string; firstName: string; lastName: string | null };
    }>,
    customers: Array<{ id: string; createdAt: Date }>,
    telegramUpdates: Array<{ payload: unknown }>,
    from: string,
    to: string,
    timezone: string,
  ) {
    const days = new Map<string, { date: string; appointments: number; completed: number; revenue: number; cancelled: number }>();
    for (let date = from; date <= to; date = addDays(date, 1)) {
      days.set(date, { date, appointments: 0, completed: 0, revenue: 0, cancelled: 0 });
    }
    const services = new Map<string, { id: string; name: string; appointments: number; completed: number; revenue: number }>();
    const employees = new Map<string, { id: string; name: string; appointments: number; completed: number; revenue: number }>();
    const source = { telegram: 0, dashboard: 0 };
    const cancelledStatuses: AppointmentStatus[] = [
      AppointmentStatus.CANCELLED_BY_COMPANY,
      AppointmentStatus.CANCELLED_BY_CUSTOMER,
    ];
    let cancelled = 0;
    let noShows = 0;
    let completed = 0;
    let actualRevenue = 0;

    for (const appointment of appointments) {
      const date = dateInTimeZone(appointment.startsAt, timezone);
      const day = days.get(date);
      if (day) {
        day.appointments += 1;
        if (appointment.status === AppointmentStatus.COMPLETED) {
          day.completed += 1;
          day.revenue += appointment.priceSnapshot.toNumber();
        }
        if (cancelledStatuses.includes(appointment.status)) {
          day.cancelled += 1;
        }
      }
      if (appointment.source === AppointmentSource.TELEGRAM) source.telegram += 1;
      else source.dashboard += 1;
      if (cancelledStatuses.includes(appointment.status)) cancelled += 1;
      if (appointment.status === AppointmentStatus.NO_SHOW) noShows += 1;
      const service = services.get(appointment.service.id) ?? {
        id: appointment.service.id, name: appointment.service.name, appointments: 0, completed: 0, revenue: 0,
      };
      service.appointments += 1;
      if (appointment.status === AppointmentStatus.COMPLETED) {
        service.completed += 1;
        service.revenue += appointment.priceSnapshot.toNumber();
      }
      services.set(service.id, service);
      const employeeName = [appointment.employee.firstName, appointment.employee.lastName].filter(Boolean).join(' ');
      const employee = employees.get(appointment.employee.id) ?? {
        id: appointment.employee.id, name: employeeName, appointments: 0, completed: 0, revenue: 0,
      };
      employee.appointments += 1;
      if (appointment.status === AppointmentStatus.COMPLETED) {
        employee.completed += 1;
        employee.revenue += appointment.priceSnapshot.toNumber();
      }
      employees.set(employee.id, employee);
      if (appointment.status === AppointmentStatus.COMPLETED) {
        completed += 1;
        actualRevenue += appointment.priceSnapshot.toNumber();
      }
    }
    const periodStart = dateOnlyToUtc(from);
    const customerIds = new Set(appointments.map((item) => item.customerId));
    const newCustomers = customers.filter((customer) => customerIds.has(customer.id) && customer.createdAt >= periodStart).length;
    const total = appointments.length;
    const funnel = { started: 0, serviceSelected: 0, dateSelected: 0, timeSelected: 0, booked: 0 };
    for (const update of telegramUpdates) {
      const payload = update.payload as { message?: { text?: unknown }; callback_query?: { data?: unknown } };
      const text = typeof payload.message?.text === 'string' ? payload.message.text : '';
      const callback = typeof payload.callback_query?.data === 'string' ? payload.callback_query.data : '';
      if (text.startsWith('/start') || callback === 'b') funnel.started += 1;
      if (callback.startsWith('s:')) funnel.serviceSelected += 1;
      if (callback.startsWith('d:')) funnel.dateSelected += 1;
      if (callback.startsWith('t:')) funnel.timeSelected += 1;
    }
    funnel.booked = source.telegram;
    return {
      summary: {
        appointments: total,
        completed,
        cancelled,
        noShows,
        actualRevenue: actualRevenue.toFixed(2),
        averageCheck: completed ? (actualRevenue / completed).toFixed(2) : '0.00',
        cancellationRate: total ? Math.round((cancelled / total) * 100) : 0,
        noShowRate: total ? Math.round((noShows / total) * 100) : 0,
        newCustomers,
        returningCustomers: Math.max(0, customerIds.size - newCustomers),
      },
      daily: [...days.values()],
      sources: source,
      funnel: {
        ...funnel,
        conversion: funnel.started ? Math.round((funnel.booked / funnel.started) * 100) : 0,
      },
      services: [...services.values()].sort((a, b) => b.revenue - a.revenue || b.appointments - a.appointments),
      employees: [...employees.values()].sort((a, b) => b.revenue - a.revenue || b.appointments - a.appointments),
    };
  }

  private customerName(customer: {
    firstName: string;
    lastName: string | null;
    username: string | null;
    phone: string | null;
  }): string {
    const names = [customer.firstName, customer.lastName]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value && /[\p{L}\p{N}]/u.test(value)));
    if (names.length) return names.join(' ');
    if (customer.username) return `@${customer.username.replace(/^@/, '')}`;
    return customer.phone ?? 'Клиент Telegram';
  }

  private capacity(
    from: string,
    to: string,
    rules: Array<{ employeeId: string; weekday: number; startTime: string; endTime: string }>,
    exceptions: Array<{ employeeId: string; date: Date; type: ScheduleExceptionType; startTime: string | null; endTime: string | null }>,
  ): number {
    let total = 0;
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const dayExceptions = exceptions.filter(
        (item) => item.date.toISOString().slice(0, 10) === date,
      );
      const employeeIds = new Set(rules.map((rule) => rule.employeeId));
      for (const employeeId of employeeIds) {
        const ownExceptions = dayExceptions.filter((item) => item.employeeId === employeeId);
        if (ownExceptions.some((item) => item.type !== ScheduleExceptionType.CUSTOM_HOURS)) continue;
        const intervals = ownExceptions.length
          ? ownExceptions
              .filter((item) => item.startTime && item.endTime)
              .map((item) => ({ start: item.startTime!, end: item.endTime! }))
          : rules
              .filter((rule) => rule.employeeId === employeeId && rule.weekday === isoWeekday(date))
              .map((rule) => ({ start: rule.startTime, end: rule.endTime }));
        total += intervals.reduce(
          (sum, interval) => sum + parseTimeToMinutes(interval.end) - parseTimeToMinutes(interval.start),
          0,
        );
      }
    }
    return total;
  }
}
