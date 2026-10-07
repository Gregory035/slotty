import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { TelegramMiniAppService } from './telegram-miniapp.service';

describe('TelegramMiniAppService', () => {
  const companyId = '6b89a7b4-4ac8-4424-922a-5d4fc44322a0';
  const serviceId = '8d4ad235-cdb7-4df8-922d-e92e51a75d02';
  const employeeId = '21cedac8-b12a-401d-b669-b9bb567869b2';
  const token = 'telegram-bot-token';
  let prisma: any;
  let scheduling: any;
  let appointments: any;
  let encryption: any;
  let miniApp: TelegramMiniAppService;

  beforeEach(() => {
    prisma = {
      bot: { findFirst: jest.fn().mockResolvedValue({ tokenEncrypted: 'encrypted' }) },
      company: { findFirst: jest.fn().mockResolvedValue({
        name: 'Studio', description: null, timezone: 'Europe/Moscow', currency: 'RUB', logoUrl: null, maxBookingHorizonDays: 14,
      }) },
      service: { findMany: jest.fn().mockResolvedValue([{
        id: serviceId, name: 'Стрижка', description: null, durationMinutes: 60, price: { toFixed: () => '2500.00' }, category: null, photoUrl: null,
        employees: [{ employee: { id: employeeId, firstName: 'Елена', lastName: null, photoUrl: null, description: null, color: '#4F46E5', workExamples: [], appointments: [] } }],
      }]) },
    };
    scheduling = { getAvailability: jest.fn().mockResolvedValue({ slots: [] }) };
    appointments = { createFromTelegram: jest.fn().mockResolvedValue({ appointmentId: 'appointment-id' }) };
    encryption = { decrypt: jest.fn().mockReturnValue(token) };
    miniApp = new TelegramMiniAppService(prisma, scheduling, appointments, encryption);
  });

  it('accepts Telegram-signed initData and exposes only a bookable catalog', async () => {
    const result = await miniApp.getSession(companyId, signedInitData());

    expect(result.company.name).toBe('Studio');
    expect(result.services).toEqual([expect.objectContaining({
      id: serviceId,
      price: '2500.00',
      employees: [expect.objectContaining({ id: employeeId, name: 'Елена' })],
    })]);
    expect(encryption.decrypt).toHaveBeenCalledWith('encrypted');
  });

  it('rejects a forged Telegram user before scheduling or booking', async () => {
    await expect(miniApp.getAvailability(companyId, {
      initData: `${signedInitData()}forged`, serviceId, employeeId, date: '2030-01-10',
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(scheduling.getAvailability).not.toHaveBeenCalled();
  });

  it('uses the verified Telegram user when creating a booking', async () => {
    await miniApp.createBooking(companyId, {
      initData: signedInitData(), serviceId, employeeId, date: '2030-01-10', time: '12:00',
    });

    expect(appointments.createFromTelegram).toHaveBeenCalledWith(companyId, {
      telegramId: 42, firstName: 'Ivan', lastName: 'Petrov', username: 'ivan',
    }, employeeId, serviceId, '2030-01-10', '12:00');
  });

  function signedInitData() {
    const values = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      query_id: 'AAH_test',
      user: JSON.stringify({ id: 42, first_name: 'Ivan', last_name: 'Petrov', username: 'ivan' }),
    });
    const dataCheckString = [...values.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    values.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
    return values.toString();
  }
});
