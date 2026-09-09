import { UnauthorizedException } from '@nestjs/common';
import type { Update } from 'grammy/types';
import {
  addDays,
  dateInTimeZone,
  isoWeekday,
} from '../scheduling/time-zone.util';
import { encodeUuid } from './callback-data.util';
import { TelegramBookingService } from './telegram-booking.service';

describe('TelegramBookingService', () => {
  const companyId = '6b89a7b4-4ac8-4424-922a-5d4fc44322a0';
  const serviceId = '8d4ad235-cdb7-4df8-922d-e92e51a75d02';
  const employeeId = '21cedac8-b12a-401d-b669-b9bb567869b2';
  const appointmentId = '0f63a55b-87e5-45f5-913c-8e562e882092';
  const bot = {
    id: '13c26f24-77ff-44e8-9bc9-28991f5d2856',
    companyId,
    tokenEncrypted: 'encrypted-token',
    status: 'ACTIVE',
  };
  let prisma: any;
  let scheduling: any;
  let appointments: any;
  let waitlist: any;
  let encryption: any;
  let telegramApi: any;
  let booking: TelegramBookingService;

  beforeEach(() => {
    prisma = {
      bot: { findUnique: jest.fn().mockResolvedValue(bot) },
      company: {
        findFirst: jest.fn().mockResolvedValue({ name: 'Studio' }),
        findUnique: jest.fn().mockResolvedValue({
          name: 'Studio',
          currency: 'RUB',
          timezone: 'Europe/Moscow',
          maxBookingHorizonDays: 14,
        }),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: serviceId,
            name: 'Стрижка',
            price: { toFixed: () => '2500.00' },
          },
        ]),
      },
      employeeService: { findFirst: jest.fn() },
      appointment: { findFirst: jest.fn() },
      review: { create: jest.fn().mockResolvedValue({ id: '2a1fc59e-5cf2-4f0f-89e9-97604310270f' }) },
      telegramUpdate: {
        create: jest.fn().mockResolvedValue({ id: 'queued-id' }),
        findUnique: jest.fn(),
      },
    };
    scheduling = { getAvailability: jest.fn() };
    appointments = {
      createFromTelegram: jest.fn().mockResolvedValue({
        appointmentId: 'appointment-id',
        startsAt: new Date('2030-01-07T09:00:00.000Z'),
        endsAt: new Date('2030-01-07T10:00:00.000Z'),
        serviceName: 'Стрижка',
        employeeName: 'Елена',
        price: '2500.00',
        currency: 'RUB',
        timezone: 'Europe/Moscow',
      }),
    };
    waitlist = { joinFromTelegram: jest.fn() };
    encryption = { decrypt: jest.fn().mockReturnValue('bot-token') };
    telegramApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      clearInlineKeyboard: jest.fn().mockResolvedValue(undefined),
    };
    booking = new TelegramBookingService(
      prisma,
      scheduling,
      appointments,
      waitlist,
      encryption,
      telegramApi,
    );
  });

  it('rejects a webhook with the wrong Telegram secret header', async () => {
    await expect(
      booking.handleWebhook('expected', 'wrong', { update_id: 1 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.bot.findUnique).not.toHaveBeenCalled();
  });

  async function process(update: Update): Promise<void> {
    await booking.handleWebhook('secret', 'secret', update);
    prisma.telegramUpdate.findUnique.mockResolvedValue({
      id: 'queued-id',
      status: 'PROCESSING',
      payload: update,
      bot,
    });
    await booking.processQueuedUpdate('queued-id');
  }

  it('queues a start message and shows the main menu', async () => {
    const update = {
      update_id: 1,
      message: {
        message_id: 1,
        date: 1,
        chat: { id: 42, type: 'private', first_name: 'Ivan' },
        from: { id: 42, is_bot: false, first_name: 'Ivan' },
        text: '/start',
      },
    } as unknown as Update;

    await process(update);

    expect(telegramApi.sendMessage).toHaveBeenCalledTimes(1);
    const keyboard = telegramApi.sendMessage.mock.calls[0][3];
    expect(keyboard.inline_keyboard[0][0].callback_data).toBe('b');
    expect(prisma.telegramUpdate.create).toHaveBeenCalled();
  });

  it('creates an appointment from a compact time callback', async () => {
    const date = dateInTimeZone(new Date(), 'Europe/Moscow');
    const callbackDate = date.replaceAll('-', '');
    const data = `t:${encodeUuid(serviceId)}:${encodeUuid(employeeId)}:${callbackDate}:1200`;
    const update = {
      update_id: 2,
      callback_query: {
        id: 'callback-id',
        chat_instance: 'chat-instance',
        from: {
          id: 42,
          is_bot: false,
          first_name: 'Ivan',
          username: 'ivan',
        },
        data,
        message: {
          message_id: 2,
          date: 1,
          chat: { id: 42, type: 'private', first_name: 'Ivan' },
          text: 'Выберите время',
        },
      },
    } as unknown as Update;

    await process(update);

    expect(telegramApi.answerCallbackQuery).toHaveBeenCalledWith(
      'bot-token',
      'callback-id',
    );
    expect(appointments.createFromTelegram).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({ telegramId: 42, username: 'ivan' }),
      employeeId,
      serviceId,
      date,
      '12:00',
    );
    expect(telegramApi.sendMessage.mock.calls.at(-1)[2]).toContain(
      'Запись подтверждена',
    );
  });

  it('continues handling a callback when its acknowledgement has expired', async () => {
    telegramApi.answerCallbackQuery.mockRejectedValueOnce(
      new Error('query is too old'),
    );
    const update = {
      update_id: 3,
      callback_query: {
        id: 'expired-callback-id',
        chat_instance: 'chat-instance',
        from: { id: 42, is_bot: false, first_name: 'Ivan' },
        data: 'h',
        message: {
          message_id: 3,
          date: 1,
          chat: { id: 42, type: 'private', first_name: 'Ivan' },
          text: 'Записаться',
        },
      },
    } as unknown as Update;

    await expect(
      process(update),
    ).resolves.toBeUndefined();
    expect(telegramApi.sendMessage).toHaveBeenCalledTimes(1);
    expect(telegramApi.sendMessage.mock.calls[0][2]).toContain(
      'Studio',
    );
  });

  it('stores one review for a completed Telegram appointment', async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      id: appointmentId,
      customerId: '4a552bda-b182-47de-91e0-810c789fcf93',
      review: null,
    });
    const update = {
      update_id: 5,
      callback_query: {
        id: 'review-callback-id',
        chat_instance: 'chat-instance',
        from: { id: 42, is_bot: false, first_name: 'Ivan' },
        data: `v:${encodeUuid(appointmentId)}:5`,
        message: {
          message_id: 5,
          date: 1,
          chat: { id: 42, type: 'private', first_name: 'Ivan' },
          text: 'Оцените услугу',
        },
      },
    } as unknown as Update;

    await process(update);

    expect(prisma.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ appointmentId, companyId, rating: 5 }),
    }));
    expect(telegramApi.clearInlineKeyboard).toHaveBeenCalledWith(
      'bot-token',
      42,
      5,
    );
    expect(telegramApi.sendMessage.mock.calls.at(-1)[2]).toContain('5 из 5');
  });

  it('shows only dates that have available slots', async () => {
    const today = dateInTimeZone(new Date(), 'Europe/Moscow');
    const availableDate = addDays(today, 2);
    prisma.employeeService.findFirst.mockResolvedValue({ employeeId });
    scheduling.getAvailability.mockImplementation(
      (_companyId: string, query: { date: string }) =>
        Promise.resolve({
          slots: query.date === availableDate ? [{ startsAt: 'slot' }] : [],
        }),
    );
    const update = {
      update_id: 4,
      callback_query: {
        id: 'employee-callback-id',
        chat_instance: 'chat-instance',
        from: { id: 42, is_bot: false, first_name: 'Ivan' },
        data: `e:${encodeUuid(serviceId)}:${encodeUuid(employeeId)}`,
        message: {
          message_id: 4,
          date: 1,
          chat: { id: 42, type: 'private', first_name: 'Ivan' },
          text: 'Выберите специалиста',
        },
      },
    } as unknown as Update;

    await process(update);

    const keyboard = telegramApi.sendMessage.mock.calls[0][3];
    const dateButtons = keyboard.inline_keyboard.flat().filter(
      (button: { callback_data?: string }) =>
        button.callback_data?.startsWith('d:'),
    );
    expect(dateButtons).toHaveLength(1);
    expect(dateButtons[0].callback_data).toContain(
      availableDate.replaceAll('-', ''),
    );
    const lastDateOffset = 14 - isoWeekday(today);
    expect(scheduling.getAvailability).toHaveBeenCalledTimes(
      lastDateOffset + 1,
    );
    expect(scheduling.getAvailability.mock.calls.at(-1)[1].date).toBe(
      addDays(today, lastDateOffset),
    );
  });
});
