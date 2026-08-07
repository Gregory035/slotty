import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  ScheduleException,
  ScheduleExceptionType,
  ScheduleRule,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  AvailabilityQueryDto,
  AvailabilityResponseDto,
} from './dto/availability.dto';
import {
  ReplaceScheduleDto,
  ScheduleRuleResponseDto,
  WeeklyScheduleRuleDto,
} from './dto/replace-schedule.dto';
import {
  CreateScheduleExceptionDto,
  ScheduleExceptionListQueryDto,
  ScheduleExceptionResponseDto,
  UpdateScheduleExceptionDto,
} from './dto/schedule-exception.dto';
import {
  addDays,
  dateOnlyToUtc,
  formatDateOnly,
  isoWeekday,
  localDateTimeToUtc,
  parseDateOnly,
  parseTimeToMinutes,
} from './time-zone.util';

interface TimeInterval {
  start: number;
  end: number;
}

const FULL_DAY_EXCEPTION_TYPES: ScheduleExceptionType[] = [
  ScheduleExceptionType.DAY_OFF,
  ScheduleExceptionType.VACATION,
  ScheduleExceptionType.SICK_LEAVE,
];

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  async replaceSchedule(
    companyId: string,
    employeeId: string,
    input: ReplaceScheduleDto,
  ): Promise<ScheduleRuleResponseDto[]> {
    await this.requireEmployee(companyId, employeeId);
    this.assertNonOverlappingRules(input.rules);

    await this.prisma.$transaction([
      this.prisma.scheduleRule.deleteMany({ where: { companyId, employeeId } }),
      this.prisma.scheduleRule.createMany({
        data: input.rules.map((rule) => ({
          companyId,
          employeeId,
          weekday: rule.weekday,
          startTime: rule.startTime,
          endTime: rule.endTime,
          isWorking: true,
        })),
      }),
    ]);

    return this.findSchedule(companyId, employeeId);
  }

  async findSchedule(
    companyId: string,
    employeeId: string,
  ): Promise<ScheduleRuleResponseDto[]> {
    await this.requireEmployee(companyId, employeeId);
    const rules = await this.prisma.scheduleRule.findMany({
      where: { companyId, employeeId, isWorking: true },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    return rules.map((rule) => this.toRuleResponse(rule));
  }

  async createException(
    companyId: string,
    employeeId: string,
    input: CreateScheduleExceptionDto,
  ): Promise<ScheduleExceptionResponseDto> {
    await this.requireEmployee(companyId, employeeId);
    const normalized = this.normalizeException(input);
    await this.assertExceptionDoesNotConflict(
      companyId,
      employeeId,
      normalized,
    );

    const exception = await this.prisma.scheduleException.create({
      data: {
        companyId,
        employeeId,
        date: dateOnlyToUtc(normalized.date),
        type: normalized.type,
        startTime: normalized.startTime ?? null,
        endTime: normalized.endTime ?? null,
      },
    });
    return this.toExceptionResponse(exception);
  }

  async findExceptions(
    companyId: string,
    employeeId: string,
    query: ScheduleExceptionListQueryDto,
  ): Promise<ScheduleExceptionResponseDto[]> {
    await this.requireEmployee(companyId, employeeId);
    if (query.from) parseDateOnly(query.from);
    if (query.to) parseDateOnly(query.to);
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from must not be after to');
    }

    const exceptions = await this.prisma.scheduleException.findMany({
      where: {
        companyId,
        employeeId,
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: dateOnlyToUtc(query.from) } : {}),
                ...(query.to ? { lte: dateOnlyToUtc(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    return exceptions.map((exception) => this.toExceptionResponse(exception));
  }

  async updateException(
    companyId: string,
    employeeId: string,
    exceptionId: string,
    input: UpdateScheduleExceptionDto,
  ): Promise<ScheduleExceptionResponseDto> {
    const current = await this.requireException(
      companyId,
      employeeId,
      exceptionId,
    );
    const nextType = input.type ?? current.type;
    const switchingToFullDay =
      input.type !== undefined &&
      FULL_DAY_EXCEPTION_TYPES.includes(input.type);
    const normalized = this.normalizeException({
      date: input.date ?? formatDateOnly(current.date),
      type: nextType,
      startTime: switchingToFullDay
        ? undefined
        : input.startTime !== undefined
          ? input.startTime
          : current.startTime ?? undefined,
      endTime: switchingToFullDay
        ? undefined
        : input.endTime !== undefined
          ? input.endTime
          : current.endTime ?? undefined,
    });
    await this.assertExceptionDoesNotConflict(
      companyId,
      employeeId,
      normalized,
      exceptionId,
    );

    const exception = await this.prisma.scheduleException.update({
      where: { id: exceptionId },
      data: {
        date: dateOnlyToUtc(normalized.date),
        type: normalized.type,
        startTime: normalized.startTime ?? null,
        endTime: normalized.endTime ?? null,
      },
    });
    return this.toExceptionResponse(exception);
  }

  async deleteException(
    companyId: string,
    employeeId: string,
    exceptionId: string,
  ): Promise<void> {
    const result = await this.prisma.scheduleException.deleteMany({
      where: { id: exceptionId, companyId, employeeId },
    });
    if (result.count !== 1) {
      throw new NotFoundException('Schedule exception not found');
    }
  }

  async getAvailability(
    companyId: string,
    query: AvailabilityQueryDto,
  ): Promise<AvailabilityResponseDto> {
    parseDateOnly(query.date);
    const [company, employee, service] = await Promise.all([
      this.prisma.company.findFirst({
        where: { id: companyId, deletedAt: null },
        select: { timezone: true },
      }),
      this.prisma.employee.findFirst({
        where: {
          id: query.employeeId,
          companyId,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      }),
      this.prisma.service.findFirst({
        where: {
          id: query.serviceId,
          companyId,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true, durationMinutes: true },
      }),
    ]);
    if (!company) throw new NotFoundException('Company not found');
    if (!employee) throw new NotFoundException('Employee not found');
    if (!service) throw new NotFoundException('Service not found');

    const assignment = await this.prisma.employeeService.findFirst({
      where: {
        companyId,
        employeeId: query.employeeId,
        serviceId: query.serviceId,
      },
      select: { employeeId: true },
    });
    if (!assignment) {
      throw new BadRequestException('Service is not assigned to employee');
    }

    const weekday = isoWeekday(query.date);
    const dayStart = localDateTimeToUtc(query.date, '00:00', company.timezone);
    const nextDate = addDays(query.date, 1);
    const dayEnd = localDateTimeToUtc(nextDate, '00:00', company.timezone);
    const [rules, exceptions, appointments] = await Promise.all([
      this.prisma.scheduleRule.findMany({
        where: {
          companyId,
          employeeId: query.employeeId,
          weekday,
          isWorking: true,
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.scheduleException.findMany({
        where: {
          companyId,
          employeeId: query.employeeId,
          date: dateOnlyToUtc(query.date),
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: {
          companyId,
          employeeId: query.employeeId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
          status: {
            notIn: [
              AppointmentStatus.CANCELLED_BY_COMPANY,
              AppointmentStatus.CANCELLED_BY_CUSTOMER,
            ],
          },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const intervals = this.availabilityIntervals(rules, exceptions);
    const durationMs = service.durationMinutes * 60_000;
    const stepMs = (query.stepMinutes ?? 15) * 60_000;
    const now = Date.now();
    const slots = new Map<string, { startsAt: string; endsAt: string }>();

    for (const interval of intervals) {
      const intervalStart = localDateTimeToUtc(
        query.date,
        this.minutesToTime(interval.start),
        company.timezone,
      ).getTime();
      const intervalEnd = localDateTimeToUtc(
        query.date,
        this.minutesToTime(interval.end),
        company.timezone,
      ).getTime();

      for (
        let startsAt = intervalStart;
        startsAt + durationMs <= intervalEnd;
        startsAt += stepMs
      ) {
        const endsAt = startsAt + durationMs;
        const overlaps = appointments.some(
          (appointment) =>
            startsAt < appointment.endsAt.getTime() &&
            endsAt > appointment.startsAt.getTime(),
        );
        if (startsAt >= now && !overlaps) {
          const startIso = new Date(startsAt).toISOString();
          slots.set(startIso, {
            startsAt: startIso,
            endsAt: new Date(endsAt).toISOString(),
          });
        }
      }
    }

    return {
      date: query.date,
      timezone: company.timezone,
      employeeId: query.employeeId,
      serviceId: query.serviceId,
      durationMinutes: service.durationMinutes,
      slots: [...slots.values()].sort((a, b) =>
        a.startsAt.localeCompare(b.startsAt),
      ),
    };
  }

  private async requireEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async requireException(
    companyId: string,
    employeeId: string,
    exceptionId: string,
  ): Promise<ScheduleException> {
    const exception = await this.prisma.scheduleException.findFirst({
      where: { id: exceptionId, companyId, employeeId },
    });
    if (!exception) {
      throw new NotFoundException('Schedule exception not found');
    }
    return exception;
  }

  private assertNonOverlappingRules(rules: WeeklyScheduleRuleDto[]): void {
    const grouped = new Map<number, TimeInterval[]>();
    for (const rule of rules) {
      const interval = this.toInterval(rule.startTime, rule.endTime);
      grouped.set(rule.weekday, [...(grouped.get(rule.weekday) ?? []), interval]);
    }
    for (const intervals of grouped.values()) {
      this.assertNonOverlapping(intervals, 'Schedule rules must not overlap');
    }
  }

  private normalizeException(input: CreateScheduleExceptionDto) {
    parseDateOnly(input.date);
    if (input.type === ScheduleExceptionType.CUSTOM_HOURS) {
      if (!input.startTime || !input.endTime) {
        throw new BadRequestException(
          'CUSTOM_HOURS requires startTime and endTime',
        );
      }
      this.toInterval(input.startTime, input.endTime);
      return input;
    }
    if (input.startTime || input.endTime) {
      throw new BadRequestException(
        'Full-day exceptions must not contain startTime or endTime',
      );
    }
    return { ...input, startTime: undefined, endTime: undefined };
  }

  private async assertExceptionDoesNotConflict(
    companyId: string,
    employeeId: string,
    input: CreateScheduleExceptionDto,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.scheduleException.findMany({
      where: {
        companyId,
        employeeId,
        date: dateOnlyToUtc(input.date),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing.length === 0) return;

    const isFullDay = FULL_DAY_EXCEPTION_TYPES.includes(input.type);
    const hasFullDay = existing.some((exception) =>
      FULL_DAY_EXCEPTION_TYPES.includes(exception.type),
    );
    if (isFullDay || hasFullDay) {
      throw new BadRequestException(
        'Full-day exception conflicts with another exception on this date',
      );
    }

    const intervals = [
      this.toInterval(input.startTime!, input.endTime!),
      ...existing.map((exception) =>
        this.toInterval(exception.startTime!, exception.endTime!),
      ),
    ];
    this.assertNonOverlapping(
      intervals,
      'Custom-hours exceptions must not overlap',
    );
  }

  private availabilityIntervals(
    rules: ScheduleRule[],
    exceptions: ScheduleException[],
  ): TimeInterval[] {
    if (
      exceptions.some((exception) =>
        FULL_DAY_EXCEPTION_TYPES.includes(exception.type),
      )
    ) {
      return [];
    }
    const customHours = exceptions.filter(
      (exception) => exception.type === ScheduleExceptionType.CUSTOM_HOURS,
    );
    const source = customHours.length > 0 ? customHours : rules;
    return source
      .map((entry) => this.toInterval(entry.startTime!, entry.endTime!))
      .sort((a, b) => a.start - b.start);
  }

  private toInterval(startTime: string, endTime: string): TimeInterval {
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime');
    }
    return { start, end };
  }

  private assertNonOverlapping(
    intervals: TimeInterval[],
    message: string,
  ): void {
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index]!.start < sorted[index - 1]!.end) {
        throw new BadRequestException(message);
      }
    }
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
    const rest = (minutes % 60).toString().padStart(2, '0');
    return `${hours}:${rest}`;
  }

  private toRuleResponse(rule: ScheduleRule): ScheduleRuleResponseDto {
    return {
      id: rule.id,
      companyId: rule.companyId,
      employeeId: rule.employeeId,
      weekday: rule.weekday,
      startTime: rule.startTime,
      endTime: rule.endTime,
    };
  }

  private toExceptionResponse(
    exception: ScheduleException,
  ): ScheduleExceptionResponseDto {
    return {
      id: exception.id,
      companyId: exception.companyId,
      employeeId: exception.employeeId,
      date: formatDateOnly(exception.date),
      type: exception.type,
      startTime: exception.startTime,
      endTime: exception.endTime,
      createdAt: exception.createdAt,
      updatedAt: exception.updatedAt,
    };
  }
}
