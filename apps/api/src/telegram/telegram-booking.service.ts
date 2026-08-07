import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BotStatus } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import type { Update, User } from 'grammy/types';
import { timingSafeEqual } from 'node:crypto';
import { AppointmentsService } from '../appointments/appointments.service';
import { PrismaService } from '../database/prisma.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import {
  addDays,
  dateInTimeZone,
  parseDateOnly,
  parseTimeToMinutes,
} from '../scheduling/time-zone.util';
import { decodeUuid, encodeUuid } from './callback-data.util';
import { TelegramApiService } from './telegram-api.service';
import { TokenEncryptionService } from './token-encryption.service';

interface UpdateContext {
  chatId: number;
  user: User;
  callbackData?: string;
}

@Injectable()
export class TelegramBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly appointments: AppointmentsService,
    private readonly encryption: TokenEncryptionService,
    private readonly telegramApi: TelegramApiService,
  ) {}

  async handleWebhook(
    secret: string,
    headerSecret: string | undefined,
    update: Update,
  ): Promise<void> {
    this.assertWebhookSecret(secret, headerSecret);
    const bot = await this.prisma.bot.findUnique({
      where: { webhookSecret: secret },
    });
    if (!bot) throw new NotFoundException('Telegram bot not found');
    if (bot.status !== BotStatus.ACTIVE) return;
    const token = this.encryption.decrypt(bot.tokenEncrypted);
    const context = this.extractContext(update);
    if (!context) return;

    if (update.callback_query) {
      await this.telegramApi.answerCallbackQuery(
        token,
        update.callback_query.id,
      );
    }

    try {
      await this.routeCallback(
        bot.companyId,
        token,
        context,
      );
    } catch (error) {
      const message =
        error instanceof ConflictException
          ? 'Это время уже заняли. Пожалуйста, выберите другое.'
          : 'Не удалось выполнить действие. Начните запись заново.';
      await this.telegramApi.sendMessage(
        token,
        context.chatId,
        message,
        new InlineKeyboard().text('Записаться', 'h'),
      );
    }
  }

  private async routeCallback(
    companyId: string,
    token: string,
    context: UpdateContext,
  ): Promise<void> {
    const data = context.callbackData;
    if (!data || data === 'h') {
      await this.showServices(companyId, token, context.chatId);
      return;
    }
    const parts = data.split(':');
    if (parts[0] === 's' && parts.length === 2) {
      await this.showEmployees(
        companyId,
        token,
        context.chatId,
        decodeUuid(parts[1]!),
      );
      return;
    }
    if (parts[0] === 'e' && parts.length === 3) {
      await this.showDates(
        companyId,
        token,
        context.chatId,
        decodeUuid(parts[1]!),
        decodeUuid(parts[2]!),
      );
      return;
    }
    if (parts[0] === 'd' && parts.length === 4) {
      await this.showSlots(
        companyId,
        token,
        context.chatId,
        decodeUuid(parts[1]!),
        decodeUuid(parts[2]!),
        this.callbackDate(parts[3]!),
      );
      return;
    }
    if (parts[0] === 't' && parts.length === 5) {
      await this.createBooking(
        companyId,
        token,
        context,
        decodeUuid(parts[1]!),
        decodeUuid(parts[2]!),
        this.callbackDate(parts[3]!),
        this.callbackTime(parts[4]!),
      );
      return;
    }
    throw new BadRequestException('Unknown Telegram callback');
  }

  private async showServices(
    companyId: string,
    token: string,
    chatId: number,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, currency: true },
    });
    const services = await this.prisma.service.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
      take: 50,
    });
    if (!company) throw new NotFoundException('Company not found');
    if (services.length === 0) {
      await this.telegramApi.sendMessage(
        token,
        chatId,
        'Сейчас нет доступных услуг. Попробуйте позже.',
      );
      return;
    }
    const keyboard = new InlineKeyboard();
    for (const service of services) {
      keyboard
        .text(
          `${service.name} — ${service.price.toFixed(2)} ${company.currency.trim()}`,
          `s:${encodeUuid(service.id)}`,
        )
        .row();
    }
    await this.telegramApi.sendMessage(
      token,
      chatId,
      `Добро пожаловать в ${company.name}! Выберите услугу:`,
      keyboard,
    );
  }

  private async showEmployees(
    companyId: string,
    token: string,
    chatId: number,
    serviceId: string,
  ): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, companyId, isActive: true, deletedAt: null },
      select: { name: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    const assignments = await this.prisma.employeeService.findMany({
      where: {
        companyId,
        serviceId,
        employee: { isActive: true, deletedAt: null },
      },
      include: { employee: true },
      orderBy: { employee: { firstName: 'asc' } },
      take: 50,
    });
    if (assignments.length === 0) {
      await this.telegramApi.sendMessage(
        token,
        chatId,
        'Для этой услуги пока нет доступных специалистов.',
        new InlineKeyboard().text('К услугам', 'h'),
      );
      return;
    }
    const serviceCode = encodeUuid(serviceId);
    const keyboard = new InlineKeyboard();
    for (const { employee } of assignments) {
      const name = [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(' ');
      keyboard
        .text(name, `e:${serviceCode}:${encodeUuid(employee.id)}`)
        .row();
    }
    keyboard.text('Назад', 'h');
    await this.telegramApi.sendMessage(
      token,
      chatId,
      `${service.name}: выберите специалиста:`,
      keyboard,
    );
  }

  private async showDates(
    companyId: string,
    token: string,
    chatId: number,
    serviceId: string,
    employeeId: string,
  ): Promise<void> {
    await this.requireAssignment(companyId, employeeId, serviceId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const today = dateInTimeZone(new Date(), company.timezone);
    const serviceCode = encodeUuid(serviceId);
    const employeeCode = encodeUuid(employeeId);
    const keyboard = new InlineKeyboard();
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(today, offset);
      const label = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'UTC',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(new Date(`${date}T12:00:00.000Z`));
      keyboard
        .text(
          label,
          `d:${serviceCode}:${employeeCode}:${date.replaceAll('-', '')}`,
        )
        .row();
    }
    keyboard.text('К услугам', 'h');
    await this.telegramApi.sendMessage(
      token,
      chatId,
      'Выберите дату:',
      keyboard,
    );
  }

  private async showSlots(
    companyId: string,
    token: string,
    chatId: number,
    serviceId: string,
    employeeId: string,
    date: string,
  ): Promise<void> {
    const company = await this.requireBookableDate(companyId, date);
    const availability = await this.scheduling.getAvailability(companyId, {
      employeeId,
      serviceId,
      date,
      stepMinutes: 15,
    });
    if (availability.slots.length === 0) {
      await this.telegramApi.sendMessage(
        token,
        chatId,
        'На эту дату свободного времени нет.',
        new InlineKeyboard().text(
          'Выбрать другую дату',
          `e:${encodeUuid(serviceId)}:${encodeUuid(employeeId)}`,
        ),
      );
      return;
    }
    const serviceCode = encodeUuid(serviceId);
    const employeeCode = encodeUuid(employeeId);
    const dateCode = date.replaceAll('-', '');
    const keyboard = new InlineKeyboard();
    for (const slot of availability.slots.slice(0, 32)) {
      const localTime = new Intl.DateTimeFormat('ru-RU', {
        timeZone: company.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(slot.startsAt));
      keyboard
        .text(
          localTime,
          `t:${serviceCode}:${employeeCode}:${dateCode}:${localTime.replace(':', '')}`,
        )
        .row();
    }
    keyboard.text(
      'Назад',
      `e:${serviceCode}:${employeeCode}`,
    );
    await this.telegramApi.sendMessage(
      token,
      chatId,
      'Выберите время:',
      keyboard,
    );
  }

  private async createBooking(
    companyId: string,
    token: string,
    context: UpdateContext,
    serviceId: string,
    employeeId: string,
    date: string,
    time: string,
  ): Promise<void> {
    await this.requireBookableDate(companyId, date);
    const booking = await this.appointments.createFromTelegram(
      companyId,
      {
        telegramId: context.user.id,
        username: context.user.username,
        firstName: context.user.first_name,
        lastName: context.user.last_name,
      },
      employeeId,
      serviceId,
      date,
      time,
    );
    const localDateTime = new Intl.DateTimeFormat('ru-RU', {
      timeZone: booking.timezone,
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(booking.startsAt);
    await this.telegramApi.sendMessage(
      token,
      context.chatId,
      [
        'Запись подтверждена ✅',
        `Услуга: ${booking.serviceName}`,
        `Специалист: ${booking.employeeName}`,
        `Дата и время: ${localDateTime}`,
        `Стоимость: ${booking.price} ${booking.currency}`,
      ].join('\n'),
      new InlineKeyboard().text('Записаться ещё', 'h'),
    );
  }

  private async requireAssignment(
    companyId: string,
    employeeId: string,
    serviceId: string,
  ): Promise<void> {
    const assignment = await this.prisma.employeeService.findFirst({
      where: {
        companyId,
        employeeId,
        serviceId,
        employee: { isActive: true, deletedAt: null },
        service: { isActive: true, deletedAt: null },
      },
      select: { employeeId: true },
    });
    if (!assignment) throw new NotFoundException('Selection not found');
  }

  private async requireBookableDate(companyId: string, date: string) {
    parseDateOnly(date);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const today = dateInTimeZone(new Date(), company.timezone);
    if (date < today || date > addDays(today, 30)) {
      throw new BadRequestException('Booking date is outside allowed range');
    }
    return company;
  }

  private callbackDate(value: string): string {
    if (!/^\d{8}$/.test(value)) {
      throw new BadRequestException('Invalid callback date');
    }
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
    parseDateOnly(date);
    return date;
  }

  private callbackTime(value: string): string {
    if (!/^\d{4}$/.test(value)) {
      throw new BadRequestException('Invalid callback time');
    }
    const time = `${value.slice(0, 2)}:${value.slice(2)}`;
    parseTimeToMinutes(time);
    return time;
  }

  private extractContext(update: Update): UpdateContext | null {
    if (update.callback_query?.data && update.callback_query.message) {
      return {
        chatId: update.callback_query.message.chat.id,
        user: update.callback_query.from,
        callbackData: update.callback_query.data,
      };
    }
    if (update.message) {
      return {
        chatId: update.message.chat.id,
        user: update.message.from,
      };
    }
    return null;
  }

  private assertWebhookSecret(
    pathSecret: string,
    headerSecret: string | undefined,
  ): void {
    if (!headerSecret) throw new UnauthorizedException('Webhook secret required');
    const expected = Buffer.from(pathSecret);
    const received = Buffer.from(headerSecret);
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('Webhook secret is invalid');
    }
  }
}
