import { AppointmentStatus } from '@prisma/client';
import { SchedulingService } from './scheduling.service';

describe('SchedulingService availability', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('removes every 15-minute start that overlaps a one-hour booking', async () => {
    const prisma: any = {
      company: { findFirst: jest.fn().mockResolvedValue({ timezone: 'UTC', minBookingNoticeMinutes: 0, maxBookingHorizonDays: 30, slotStepMinutes: 15 }) },
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 'employee' }) },
      service: { findFirst: jest.fn().mockResolvedValue({ id: 'service', durationMinutes: 60 }) },
      employeeService: {
        findFirst: jest.fn().mockResolvedValue({ employeeId: 'employee', durationMinutes: null, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }),
        findMany: jest.fn().mockResolvedValue([{ serviceId: 'service', bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }]),
      },
      scheduleRule: { findMany: jest.fn().mockResolvedValue([{ startTime: '09:00', endTime: '12:00', weekday: 1 }]) },
      scheduleException: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: { findMany: jest.fn().mockResolvedValue([{ startsAt: new Date('2030-01-07T10:00:00.000Z'), endsAt: new Date('2030-01-07T11:00:00.000Z'), serviceId: 'service', status: AppointmentStatus.CONFIRMED }]) },
    };
    const service = new SchedulingService(prisma);

    const result = await service.getAvailability('company', {
      employeeId: 'employee',
      serviceId: 'service',
      date: '2030-01-07',
    });
    const starts = result.slots.map((slot) => slot.startsAt);

    expect(starts).toContain('2030-01-07T09:00:00.000Z');
    expect(starts).toContain('2030-01-07T11:00:00.000Z');
    expect(starts).not.toContain('2030-01-07T09:15:00.000Z');
    expect(starts).not.toContain('2030-01-07T09:30:00.000Z');
    expect(starts).not.toContain('2030-01-07T09:45:00.000Z');
    expect(starts).not.toContain('2030-01-07T10:00:00.000Z');
    expect(starts).not.toContain('2030-01-07T10:15:00.000Z');
    expect(starts).not.toContain('2030-01-07T10:30:00.000Z');
    expect(starts).not.toContain('2030-01-07T10:45:00.000Z');
  });
});
