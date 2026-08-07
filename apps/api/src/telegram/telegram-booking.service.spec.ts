import { UnauthorizedException } from '@nestjs/common';
import type { Update } from 'grammy/types';
import { dateInTimeZone } from '../scheduling/time-zone.util';
import { encodeUuid } from './callback-data.util';
import { TelegramBookingService } from './telegram-booking.service';

describe('TelegramBookingService', () => {
  const companyId = '6b89a7b4-4ac8-4424-922a-5d4fc44322a0';
  const serviceId = '8d4ad235-cdb7-4df8-922d-e92e51a75d02';
  const employeeId = '21cedac8-b12a-401d-b669-b9bb567869b2';
  const bot = {
    companyId,
    tokenEncrypted: 'encrypted-token',
    status: 'ACTIVE',
  };
  let prisma: any;
  let scheduling: any;
  let appointments: any;
  let encryption: any;
  let telegramApi: any;
  let booking: TelegramBookingService;

  beforeEach(() => {
    prisma = {
      bot: { findUnique: jest.fn().mockResolvedValue(bot) },
      company: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Studio',
          currency: 'RUB',
          timezone: 'Europe/Moscow',
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
    encryption = { decrypt: jest.fn().mockReturnValue('bot-token') };
    telegramApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
    };
    booking = new TelegramBookingService(
      prisma,
      scheduling,
      appointments,
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

  it('shows active services for a start message', async () => {
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

    await booking.handleWebhook('secret', 'secret', update);

    expect(telegramApi.sendMessage).toHaveBeenCalledTimes(1);
    const keyboard = telegramApi.sendMessage.mock.calls[0][3];
    expect(keyboard.inline_keyboard[0][0].callback_data).toBe(
      `s:${encodeUuid(serviceId)}`,
    );
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

    await booking.handleWebhook('secret', 'secret', update);

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
});
