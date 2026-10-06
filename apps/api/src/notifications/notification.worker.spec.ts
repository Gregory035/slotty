import { NotificationStatus, NotificationType } from '@prisma/client';
import { NotificationWorker } from './notification.worker';

describe('NotificationWorker', () => {
  it('does not send an expired waitlist offer', async () => {
    const record = {
      id: 'notification-id', companyId: 'company-id', customerId: 'customer-id', appointmentId: 'appointment-id',
      status: NotificationStatus.PROCESSING, type: NotificationType.WAITLIST_SLOT,
      customer: { telegramId: 123n }, appointment: { id: 'appointment-id' },
    };
    const prisma: any = {
      notification: { findUnique: jest.fn().mockResolvedValue(record), update: jest.fn().mockResolvedValue({}) },
      waitlistEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const telegram = { sendMessage: jest.fn() };
    const worker = new NotificationWorker(prisma, {} as never, telegram as never);

    await (worker as unknown as { send(notification: typeof record): Promise<void> }).send(record);

    expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: NotificationStatus.CANCELLED }),
    }));
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });
});
