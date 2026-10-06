import { ConflictException } from '@nestjs/common';
import { AppointmentSource, AppointmentStatus, CompanyRole, Prisma } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  const companyId = '6b89a7b4-4ac8-4424-922a-5d4fc44322a0';
  const appointmentId = '13c26f24-77ff-44e8-9bc9-28991f5d2856';
  const appointment = {
    id: appointmentId,
    companyId,
    customerId: '4a552bda-b182-47de-91e0-810c789fcf93',
    employeeId: '21cedac8-b12a-401d-b669-b9bb567869b2',
    serviceId: '8d4ad235-cdb7-4df8-922d-e92e51a75d02',
    startsAt: new Date('2030-01-07T09:00:00.000Z'),
    endsAt: new Date('2030-01-07T10:00:00.000Z'),
    status: AppointmentStatus.CANCELLED_BY_COMPANY,
    source: AppointmentSource.TELEGRAM,
    priceSnapshot: { toFixed: () => '2500.00' },
    depositAmountSnapshot: { toFixed: () => '0.00' },
    depositStatus: 'NOT_REQUIRED',
    durationMinutesSnapshot: 60,
    notes: null,
    cancellationReason: 'Специалист заболел',
    customer: {
      id: '4a552bda-b182-47de-91e0-810c789fcf93',
      telegramId: 42n,
      firstName: 'Ivan',
      lastName: null,
      username: 'ivan',
      phone: null,
    },
    employee: {
      id: '21cedac8-b12a-401d-b669-b9bb567869b2',
      firstName: 'Елена',
      lastName: 'Сок',
    },
    service: {
      id: '8d4ad235-cdb7-4df8-922d-e92e51a75d02',
      name: 'Стрижка',
      durationMinutes: 60,
    },
    company: { name: 'Прима', timezone: 'Europe/Moscow', currency: 'RUB' },
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-02T00:00:00.000Z'),
  };

  it('commits cancellation and an outbox event atomically', async () => {
    const prisma: any = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue({
          id: appointmentId,
          status: AppointmentStatus.CONFIRMED,
          employeeId: appointment.employeeId,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(appointment),
      },
      appointmentHistory: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
      notification: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn(async (operation) => operation(prisma)),
    };
    const telegramApi = { sendMessage: jest.fn() };
    const service = new AppointmentsService(
      prisma,
      {} as any,
      {} as any,
      telegramApi as any,
      {} as any,
    );

    const result = await service.updateStatus(companyId, appointmentId, {
      status: AppointmentStatus.CANCELLED_BY_COMPANY,
      cancellationReason: 'Специалист заболел',
    });

    expect(result.status).toBe(AppointmentStatus.CANCELLED_BY_COMPANY);
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'appointment.cancelled' }),
      }),
    );
    expect(prisma.notification.updateMany).toHaveBeenCalled();
    expect(telegramApi.sendMessage).not.toHaveBeenCalled();
  });

  it('maps the PostgreSQL exclusion constraint to HTTP 409', () => {
    const service = new AppointmentsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const databaseError = new Prisma.PrismaClientUnknownRequestError(
      'PostgreSQL 23P01: Appointment_no_employee_overlap',
      { clientVersion: '6.19.3' },
    );

    expect(() =>
      (service as unknown as { rethrowBookingConflict(error: unknown): never })
        .rethrowBookingConflict(databaseError),
    ).toThrow(ConflictException);
  });

  it('rejects a multi-specialist visit before any write if its second slot is unavailable', async () => {
    const prisma: any = {
      appointment: { findFirst: jest.fn().mockResolvedValue(null) },
      company: { findFirst: jest.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }) },
      $transaction: jest.fn(),
    };
    const scheduling = { getAvailability: jest.fn()
      .mockResolvedValueOnce({ slots: [{ startsAt: '2030-01-07T09:00:00.000Z', endsAt: '2030-01-07T09:30:00.000Z' }] })
      .mockResolvedValueOnce({ slots: [] }),
    };
    const entitlements = { assertCanCreateAppointment: jest.fn().mockResolvedValue(undefined) };
    const service = new AppointmentsService(prisma, scheduling as never, {} as never, {} as never, entitlements as never);

    await expect(service.createVisitFromDashboard(companyId, {
      customerId: appointment.customerId,
      items: [
        { serviceId: appointment.serviceId, employeeId: appointment.employeeId, startsAt: '2030-01-07T09:00:00.000Z' },
        { serviceId: appointment.serviceId, employeeId: 'f6cccfed-e4e7-47af-b9f8-3577065084bf', startsAt: '2030-01-07T09:30:00.000Z' },
      ],
    }, 'actor', 'request-key')).rejects.toThrow(ConflictException);
    expect(entitlements.assertCanCreateAppointment).toHaveBeenCalledWith(companyId, 2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('checks recurring visits on their actual future dates', async () => {
    const prisma: any = {
      appointment: { findFirst: jest.fn().mockResolvedValue(null) },
      company: { findFirst: jest.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }) },
      $transaction: jest.fn(),
    };
    const scheduling = { getAvailability: jest.fn()
      .mockResolvedValueOnce({ slots: [{ startsAt: '2030-01-07T09:00:00.000Z', endsAt: '2030-01-07T09:30:00.000Z' }] })
      .mockResolvedValueOnce({ slots: [] }),
    };
    const service = new AppointmentsService(prisma, scheduling as never, {} as never, {} as never, { assertCanCreateAppointment: jest.fn() } as never);

    await expect(service.createVisitFromDashboard(companyId, {
      customerId: appointment.customerId,
      items: [{ serviceId: appointment.serviceId, employeeId: appointment.employeeId, startsAt: '2030-01-07T09:00:00.000Z' }],
      recurrence: { intervalDays: 7, count: 2 },
    }, 'actor', 'series-key')).rejects.toThrow(ConflictException);
    expect(scheduling.getAvailability.mock.calls.map((call) => call[1].date)).toEqual(['2030-01-07', '2030-01-14']);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates two specialists under one visit ID in a single transaction', async () => {
    const secondEmployeeId = 'f6cccfed-e4e7-47af-b9f8-3577065084bf';
    const createdRows: Array<{ id: string; data: any }> = [];
    const tx: any = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => {
          const row = { id: `appointment-${createdRows.length + 1}`, data };
          createdRows.push(row);
          return { ...data, id: row.id };
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          const row = createdRows.find((item) => item.id === where.id_companyId.id)!;
          return {
            ...appointment,
            ...row.data,
            id: row.id,
            customer: appointment.customer,
            employee: { ...appointment.employee, id: row.data.employeeId },
            service: appointment.service,
            review: null,
          };
        }),
      },
      customer: { findUnique: jest.fn().mockResolvedValue(appointment.customer) },
      employeeService: { findUnique: jest.fn().mockImplementation(async () => ({
        durationMinutes: 30,
        price: null,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        employee: { isActive: true, deletedAt: null },
        service: { isActive: true, deletedAt: null, price: new Prisma.Decimal(1200), depositPercent: 0, depositFixedAmount: null, durationMinutes: 30 },
      })) },
      appointmentHistory: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      appointment: { findFirst: jest.fn().mockResolvedValue(null) },
      company: { findFirst: jest.fn().mockResolvedValue({ timezone: 'Europe/Moscow' }) },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const scheduling = { getAvailability: jest.fn()
      .mockResolvedValueOnce({ slots: [{ startsAt: '2030-01-07T09:00:00.000Z', endsAt: '2030-01-07T09:30:00.000Z' }] })
      .mockResolvedValueOnce({ slots: [{ startsAt: '2030-01-07T09:30:00.000Z', endsAt: '2030-01-07T10:00:00.000Z' }] }),
    };
    const service = new AppointmentsService(prisma, scheduling as never, {} as never, {} as never, { assertCanCreateAppointment: jest.fn() } as never);

    const result = await service.createVisitFromDashboard(companyId, {
      customerId: appointment.customerId,
      items: [
        { serviceId: appointment.serviceId, employeeId: appointment.employeeId, startsAt: '2030-01-07T09:00:00.000Z' },
        { serviceId: appointment.serviceId, employeeId: secondEmployeeId, startsAt: '2030-01-07T09:30:00.000Z' },
      ],
    }, 'actor', 'group-key');

    expect(result).toHaveLength(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(createdRows.map((row) => row.data.employeeId)).toEqual([appointment.employeeId, secondEmployeeId]);
    expect(createdRows[0]?.data.visitId).toBe(createdRows[1]?.data.visitId);
    expect(createdRows[0]?.data.idempotencyKey).toBe('group-key');
    expect(createdRows[1]?.data.idempotencyKey).toBeNull();
  });

  it('exports an appointment as a calendar invite without exposing another specialist\'s booking', async () => {
    const prisma: any = {
      appointment: { findFirst: jest.fn().mockResolvedValue({
        ...appointment,
        status: AppointmentStatus.CONFIRMED,
        company: { name: 'Прима', address: 'ул. Ленина, 1' },
        service: { name: 'Стрижка; укладка' },
      }) },
    };
    const service = new AppointmentsService(prisma, {} as never, {} as never, {} as never, {} as never);
    const member = { role: CompanyRole.EMPLOYEE, employeeId: appointment.employeeId } as never;

    const invite = await service.calendarInvite(companyId, appointmentId, member);

    expect(invite).toContain('BEGIN:VEVENT\r\n');
    expect(invite).toContain('DTSTART:20300107T090000Z');
    expect(invite).toContain('SUMMARY:Стрижка\\; укладка — Прима');
    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId, employeeId: appointment.employeeId }),
    }));
    prisma.appointment.findFirst.mockResolvedValueOnce(null);
    await expect(service.calendarInvite(companyId, appointmentId, member)).rejects.toThrow('Appointment not found');
  });
});
