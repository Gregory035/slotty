import { AppointmentStatus, WaitlistStatus } from '@prisma/client';
import { WaitlistService } from './waitlist.service';

describe('WaitlistService', () => {
  const companyId = '6b89a7b4-4ac8-4424-922a-5d4fc44322a0';
  const appointmentId = '13c26f24-77ff-44e8-9bc9-28991f5d2856';
  const entryId = '4a552bda-b182-47de-91e0-810c789fcf93';

  function setup() {
    const appointment = {
      id: appointmentId,
      companyId,
      employeeId: '21cedac8-b12a-401d-b669-b9bb567869b2',
      serviceId: '8d4ad235-cdb7-4df8-922d-e92e51a75d02',
      startsAt: new Date('2030-01-07T09:00:00.000Z'),
      endsAt: new Date('2030-01-07T10:00:00.000Z'),
      status: AppointmentStatus.CANCELLED_BY_CUSTOMER,
      company: { timezone: 'Europe/Moscow' },
    };
    const prisma: any = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(appointment),
        count: jest.fn().mockResolvedValue(0),
      },
      waitlistEntry: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue({ id: entryId, customerId: 'customer' }),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: { upsert: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    const service = new WaitlistService(prisma as never);
    return { service, prisma, appointment };
  }

  it('offers a cancelled future slot and creates notification atomically', async () => {
    const { service, prisma } = setup();
    await service.offerForCancelledAppointment(companyId, appointmentId);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.waitlistEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WaitlistStatus.OFFERED,
          offeredAppointmentId: appointmentId,
        }),
      }),
    );
    expect(prisma.notification.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not offer a slot that another booking occupies', async () => {
    const { service, prisma } = setup();
    prisma.appointment.count.mockResolvedValue(1);
    await service.offerForCancelledAppointment(companyId, appointmentId);
    expect(prisma.notification.upsert).not.toHaveBeenCalled();
  });

  it('expires an ignored offer and advances to the next person', async () => {
    const { service, prisma } = setup();
    prisma.waitlistEntry.findMany.mockResolvedValue([{
      id: entryId,
      companyId,
      offeredAppointmentId: appointmentId,
    }]);
    const processed = await service.sweepExpiredOffers();
    expect(processed).toBe(1);
    expect(prisma.waitlistEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: WaitlistStatus.EXPIRED } }),
    );
    expect(prisma.notification.upsert).toHaveBeenCalledTimes(1);
  });
});
