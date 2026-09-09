import { ConflictException } from '@nestjs/common';
import { AppointmentSource, AppointmentStatus, Prisma } from '@prisma/client';
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
});
