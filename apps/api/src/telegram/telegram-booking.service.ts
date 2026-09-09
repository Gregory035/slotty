import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  BotStatus,
  Prisma,
  TelegramUpdateStatus,
} from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import type { Update, User } from 'grammy/types';
import { timingSafeEqual } from 'node:crypto';
import { AppointmentsService } from '../appointments/appointments.service';
import { PrismaService } from '../database/prisma.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import {
  addDays,
  dateInTimeZone,
  isoWeekday,
  localDateTimeToUtc,
  parseDateOnly,
  parseTimeToMinutes,
} from '../scheduling/time-zone.util';
import { decodeUuid, encodeUuid } from './callback-data.util';
import { TelegramApiService } from './telegram-api.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { TokenEncryptionService } from './token-encryption.service';

interface UpdateContext {
  chatId: number;
  user: User;
  callbackData?: string;
  messageId?: number;
}

@Injectable()
export class TelegramBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly appointments: AppointmentsService,
    private readonly waitlist: WaitlistService,
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
    try {
      await this.prisma.telegramUpdate.create({
        data: {
          companyId: bot.companyId,
          botId: bot.id,
          updateId: BigInt(update.update_id),
          payload: JSON.parse(JSON.stringify(update)) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }
  }

  async processQueuedUpdate(id: string): Promise<void> {
    const queued = await this.prisma.telegramUpdate.findUnique({
      where: { id },
      include: { bot: true },
    });
    if (!queued || queued.status !== TelegramUpdateStatus.PROCESSING) return;
    if (queued.bot.status !== BotStatus.ACTIVE) return;
    const update = queued.payload as unknown as Update;
    const bot = queued.bot;
    const token = this.encryption.decrypt(bot.tokenEncrypted);
    const context = this.extractContext(update);
    if (!context) return;

    if (update.callback_query) {
      try {
        await this.telegramApi.answerCallbackQuery(
          token,
          update.callback_query.id,
        );
      } catch {
        // Telegram rejects acknowledgements for callbacks older than a few
        // seconds. The booking action itself can still be handled safely.
      }
    }

    try {
      if (!update.callback_query && update.message && 'text' in update.message) {
        const text = update.message.text?.trim();
        if (text && !text.startsWith('/') && await this.savePendingReviewComment(
          bot.companyId,
          token,
          context,
          text,
        )) return;
      }
      await this.routeCallback(
        bot.companyId,
        token,
        context,
      );
    } catch (error) {
      if (
        !(error instanceof ConflictException) &&
        !(error instanceof BadRequestException) &&
        !(error instanceof NotFoundException)
      ) {
        throw error;
      }
      const message =
        error instanceof ConflictException
          ? 'Это время уже заняли. Пожалуйста, выберите другое.'
          : 'Не удалось выполнить действие. Начните запись заново.';
      await this.telegramApi.sendMessage(
        token,
        context.chatId,
        message,
        new InlineKeyboard().text('Главное меню', 'h'),
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
      await this.showMainMenu(companyId, token, context.chatId);
      return;
    }
    if (data === 'b') {
      await this.showServices(companyId, token, context.chatId);
      return;
    }
    if (data === 'm') {
      await this.showAppointments(companyId, token, context, 'upcoming');
      return;
    }
    if (data === 'mu' || data === 'ma') {
      await this.showAppointments(companyId, token, context, data === 'mu' ? 'upcoming' : 'archive');
      return;
    }
    if (data === 'c') {
      await this.showCompanyContacts(companyId, token, context.chatId);
      return;
    }
    const parts = data.split(':');
    if (parts[0] === 'a' && parts.length === 2) {
      await this.showAppointmentDetails(companyId, token, context, decodeUuid(parts[1]!));
      return;
    }
    if ((parts[0] === 'p' || parts[0] === 'pc') && parts.length === 2) {
      await this.repeatAppointment(companyId, token, context, decodeUuid(parts[1]!), parts[0] === 'pc');
      return;
    }
    if (parts[0] === 'cf' && parts.length === 2) {
      await this.confirmVisit(companyId, token, context, decodeUuid(parts[1]!));
      return;
    }
    if (parts[0] === 'vs' && parts.length === 2) {
      await this.skipReviewComment(companyId, token, context, decodeUuid(parts[1]!));
      return;
    }
    if (parts[0] === 'x' && parts.length === 2) {
      await this.cancelCustomerAppointment(
        companyId,
        token,
        context,
        decodeUuid(parts[1]!),
      );
      return;
    }
    if (parts[0] === 'v' && parts.length === 3) {
      await this.submitReview(
        companyId,
        token,
        context,
        decodeUuid(parts[1]!),
        Number(parts[2]),
      );
      return;
    }
    if (parts[0] === 'r' && parts.length === 2) {
      await this.showRescheduleDates(
        companyId,
        token,
        context,
        decodeUuid(parts[1]!),
      );
      return;
    }
    if (parts[0] === 'rd' && parts.length === 3) {
      await this.showRescheduleSlots(
        companyId,
        token,
        context,
        decodeUuid(parts[1]!),
        this.callbackDate(parts[2]!),
      );
      return;
    }
    if (parts[0] === 'rt' && parts.length === 4) {
      await this.rescheduleCustomerAppointment(
        companyId,
        token,
        context,
        decodeUuid(parts[1]!),
        this.callbackDate(parts[2]!),
        this.callbackTime(parts[3]!),
      );
      return;
    }
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
    if (parts[0] === 'w' && parts.length === 4) {
      await this.waitlist.joinFromTelegram(companyId, {
        telegramId: context.user.id,
        username: context.user.username,
        firstName: context.user.first_name,
        lastName: context.user.last_name,
      }, decodeUuid(parts[1]!), decodeUuid(parts[2]!), this.callbackDate(parts[3]!));
      await this.telegramApi.sendMessage(token, context.chatId, 'Добавили в лист ожидания. Напишем, если на этот день появится свободное окно.');
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

  private async showMainMenu(
    companyId: string,
    token: string,
    chatId: number,
  ): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { name: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    await this.telegramApi.sendMessage(
      token,
      chatId,
      `${company.name}: чем помочь?`,
      new InlineKeyboard()
        .text('Записаться', 'b')
        .row()
        .text('Мои записи', 'm')
        .row()
        .text('Контакты', 'c'),
    );
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

  private async showAppointments(
    companyId: string,
    token: string,
    context: UpdateContext,
    scope: 'upcoming' | 'archive',
  ): Promise<void> {
    const now = new Date();
    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        customer: { telegramId: BigInt(context.user.id) },
        ...(scope === 'upcoming'
          ? { startsAt: { gte: now }, status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] } }
          : { OR: [
              { startsAt: { lt: now } },
              { status: { in: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW, AppointmentStatus.CANCELLED_BY_COMPANY, AppointmentStatus.CANCELLED_BY_CUSTOMER] } },
            ] }),
      },
      include: { company: true, employee: true, service: true, review: true },
      orderBy: [{ startsAt: scope === 'upcoming' ? 'asc' : 'desc' }, { id: 'asc' }],
      take: 10,
    });
    if (!appointments.length) {
      await this.telegramApi.sendMessage(
        token,
        context.chatId,
        scope === 'upcoming' ? 'У вас нет предстоящих записей.' : 'Архив записей пока пуст.',
        new InlineKeyboard()
          .text(scope === 'upcoming' ? 'Архив' : 'Предстоящие', scope === 'upcoming' ? 'ma' : 'mu')
          .row().text('Записаться', 'b').row().text('Главное меню', 'h'),
      );
      return;
    }
    const keyboard = new InlineKeyboard();
    for (const appointment of appointments) {
      const date = new Intl.DateTimeFormat('ru-RU', {
        timeZone: appointment.company.timezone,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(appointment.startsAt);
      const code = encodeUuid(appointment.id);
      keyboard.text(`${date} · ${appointment.service.name}`, `a:${code}`).row();
    }
    keyboard
      .text('Предстоящие', 'mu')
      .text('Архив', 'ma')
      .row()
      .text('Главное меню', 'h');
    await this.telegramApi.sendMessage(
      token,
      context.chatId,
      `${scope === 'upcoming' ? 'Предстоящие записи' : 'Архив'}\n\n${appointments
        .map((appointment, index) => {
          const date = new Intl.DateTimeFormat('ru-RU', {
            timeZone: appointment.company.timezone,
            dateStyle: 'long',
            timeStyle: 'short',
          }).format(appointment.startsAt);
          return `${index + 1}. ${appointment.service.name} — ${date}\n${this.appointmentStatusLabel(appointment.status)}${appointment.review ? ` · ${appointment.review.rating} ★` : ''}`;
        })
        .join('\n\n')}`,
      keyboard,
    );
  }

  private async showAppointmentDetails(
    companyId: string,
    token: string,
    context: UpdateContext,
    appointmentId: string,
  ): Promise<void> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId, customer: { telegramId: BigInt(context.user.id) } },
      include: { company: true, employee: true, service: true, review: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    const date = new Intl.DateTimeFormat('ru-RU', {
      timeZone: appointment.company.timezone,
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(appointment.startsAt);
    const employee = [appointment.employee.firstName, appointment.employee.lastName].filter(Boolean).join(' ');
    const upcoming = appointment.startsAt >= new Date() && ([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] as AppointmentStatus[]).includes(appointment.status);
    const code = encodeUuid(appointment.id);
    const keyboard = new InlineKeyboard();
    if (upcoming) {
      keyboard.text('Перенести', `r:${code}`).text('Отменить', `x:${code}`).row();
    }
    keyboard.text('Повторить запись', `p:${code}`).row();
    keyboard.text(upcoming ? 'К предстоящим' : 'К архиву', upcoming ? 'mu' : 'ma');
    await this.telegramApi.sendMessage(token, context.chatId, [
      appointment.service.name,
      `Дата и время: ${date}`,
      `Специалист: ${employee}`,
      `Длительность: ${appointment.durationMinutesSnapshot} мин`,
      `Стоимость: ${appointment.priceSnapshot.toFixed(2)} ${appointment.company.currency.trim()}`,
      `Статус: ${this.appointmentStatusLabel(appointment.status)}`,
      appointment.customerConfirmedAt ? 'Визит подтверждён клиентом ✅' : null,
      appointment.review ? `Оценка: ${appointment.review.rating} ★${appointment.review.comment ? `\n${appointment.review.comment}` : ''}` : null,
      appointment.company.address ? `Адрес: ${appointment.company.address}` : null,
      appointment.company.phone ? `Телефон: ${appointment.company.phone}` : null,
    ].filter((line): line is string => Boolean(line)).join('\n'), keyboard);
  }

  private async repeatAppointment(
    companyId: string,
    token: string,
    context: UpdateContext,
    appointmentId: string,
    confirmedChanges: boolean,
  ): Promise<void> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId, customer: { telegramId: BigInt(context.user.id) } },
      include: { service: true, employee: true, company: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    const assignment = await this.prisma.employeeService.findFirst({
      where: {
        companyId,
        employeeId: appointment.employeeId,
        serviceId: appointment.serviceId,
        employee: { isActive: true, deletedAt: null },
        service: { isActive: true, deletedAt: null },
      },
      include: { service: true },
    });
    if (!assignment) {
      await this.telegramApi.sendMessage(token, context.chatId, 'Эта услуга или специалист больше недоступны.', new InlineKeyboard().text('Выбрать услугу', 'b'));
      return;
    }
    const currentPrice = assignment.price ?? assignment.service.price;
    const currentDuration = assignment.durationMinutes ?? assignment.service.durationMinutes;
    const changed = !currentPrice.equals(appointment.priceSnapshot) || currentDuration !== appointment.durationMinutesSnapshot;
    if (changed && !confirmedChanges) {
      const code = encodeUuid(appointment.id);
      await this.telegramApi.sendMessage(token, context.chatId, [
        'Параметры услуги изменились.',
        `Было: ${appointment.priceSnapshot.toFixed(2)} ${appointment.company.currency.trim()}, ${appointment.durationMinutesSnapshot} мин`,
        `Сейчас: ${currentPrice.toFixed(2)} ${appointment.company.currency.trim()}, ${currentDuration} мин`,
      ].join('\n'), new InlineKeyboard().text('Продолжить', `pc:${code}`).row().text('К записи', `a:${code}`));
      return;
    }
    await this.showDates(companyId, token, context.chatId, appointment.serviceId, appointment.employeeId);
  }

  private async confirmVisit(
    companyId: string,
    token: string,
    context: UpdateContext,
    appointmentId: string,
  ): Promise<void> {
    const appointment = await this.requireCustomerAppointment(companyId, appointmentId, context.user.id);
    await this.prisma.appointment.update({
      where: { id_companyId: { id: appointment.id, companyId } },
      data: { customerConfirmedAt: new Date() },
    });
    if (context.messageId) await this.telegramApi.clearInlineKeyboard(token, context.chatId, context.messageId).catch(() => undefined);
    await this.telegramApi.sendMessage(token, context.chatId, 'Визит подтверждён ✅', new InlineKeyboard().text('Мои записи', 'm'));
  }

  private async showCompanyContacts(
    companyId: string,
    token: string,
    chatId: number,
  ): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { name: true, phone: true, email: true, address: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    await this.telegramApi.sendMessage(
      token,
      chatId,
      [
        company.name,
        company.phone ? `Телефон: ${company.phone}` : null,
        company.email ? `Email: ${company.email}` : null,
        company.address ? `Адрес: ${company.address}` : null,
      ].filter((line): line is string => Boolean(line)).join('\n'),
      new InlineKeyboard().text('Главное меню', 'h'),
    );
  }

  private async cancelCustomerAppointment(
    companyId: string,
    token: string,
    context: UpdateContext,
    appointmentId: string,
  ): Promise<void> {
    const appointment = await this.requireCustomerAppointment(companyId, appointmentId, context.user.id);
    const cutoff = appointment.startsAt.getTime() - appointment.company.cancellationNoticeMinutes * 60_000;
    if (Date.now() > cutoff) {
      await this.telegramApi.sendMessage(
        token,
        context.chatId,
        'Онлайн-отмена уже недоступна. Свяжитесь с компанией.',
        new InlineKeyboard().text('Контакты', 'c').row().text('Мои записи', 'm'),
      );
      return;
    }
    await this.appointments.updateStatus(
      companyId,
      appointmentId,
      { status: AppointmentStatus.CANCELLED_BY_CUSTOMER },
    );
    await this.telegramApi.sendMessage(
      token,
      context.chatId,
      'Запись отменена.',
      new InlineKeyboard().text('Мои записи', 'm').row().text('Главное меню', 'h'),
    );
  }

  private async showRescheduleDates(
    companyId: string,
    token: string,
    context: UpdateContext,
    appointmentId: string,
  ): Promise<void> {
    const appointment = await this.requireCustomerAppointment(companyId, appointmentId, context.user.id);
    const today = dateInTimeZone(new Date(), appointment.company.timezone);
    const lastOffset = Math.min(
      14 - isoWeekday(today),
      appointment.company.maxBookingHorizonDays,
    );
    const dates = (
      await Promise.all(
        Array.from({ length: lastOffset + 1 }, async (_, offset) => {
          const date = addDays(today, offset);
          const availability = await this.scheduling.getAvailability(
            companyId,
            { employeeId: appointment.employeeId, serviceId: appointment.serviceId, date },
            appointment.id,
          );
          return availability.slots.length ? date : null;
        }),
      )
    ).filter((date): date is string => Boolean(date));
    const code = encodeUuid(appointment.id);
    const keyboard = new InlineKeyboard();
    for (const date of dates) {
      const label = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
      }).format(new Date(`${date}T12:00:00Z`));
      keyboard.text(label, `rd:${code}:${date.replaceAll('-', '')}`).row();
    }
    keyboard.text('Мои записи', 'm');
    await this.telegramApi.sendMessage(
      token,
      context.chatId,
      dates.length ? 'Выберите новую дату:' : 'Свободных дат пока нет.',
      keyboard,
    );
  }

  private async showRescheduleSlots(
    companyId: string,
    token: string,
    context: UpdateContext,
    appointmentId: string,
    date: string,
  ): Promise<void> {
    const appointment = await this.requireCustomerAppointment(companyId, appointmentId, context.user.id);
    const availability = await this.scheduling.getAvailability(
      companyId,
      { employeeId: appointment.employeeId, serviceId: appointment.serviceId, date },
      appointment.id,
    );
    const code = encodeUuid(appointment.id);
    const dateCode = date.replaceAll('-', '');
    const keyboard = new InlineKeyboard();
    for (const slot of availability.slots.slice(0, 32)) {
      const time = new Intl.DateTimeFormat('ru-RU', {
        timeZone: appointment.company.timezone,
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).format(new Date(slot.startsAt));
      keyboard.text(time, `rt:${code}:${dateCode}:${time.replace(':', '')}`).row();
    }
    keyboard.text('Назад', `r:${code}`);
    await this.telegramApi.sendMessage(
      token,
      context.chatId,
      availability.slots.length ? 'Выберите новое время:' : 'На эту дату времени нет.',
      keyboard,
    );
  }

  private async rescheduleCustomerAppointment(
    companyId: string,
    token: string,
    context: UpdateContext,
    appointmentId: string,
    date: string,
    time: string,
  ): Promise<void> {
    const appointment = await this.requireCustomerAppointment(companyId, appointmentId, context.user.id);
    const startsAt = localDateTimeToUtc(date, time, appointment.company.timezone);
    await this.appointments.reschedule(companyId, appointmentId, { startsAt: startsAt.toISOString() });
    await this.telegramApi.sendMessage(
      token,
      context.chatId,
      'Запись перенесена ✅',
      new InlineKeyboard().text('Мои записи', 'm').row().text('Главное меню', 'h'),
    );
  }

  private async requireCustomerAppointment(companyId: string, appointmentId: string, telegramId: number) {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        companyId,
        customer: { telegramId: BigInt(telegramId) },
        startsAt: { gte: new Date() },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      include: { company: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
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
        new InlineKeyboard().text('К услугам', 'b'),
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
    keyboard.text('Назад', 'b');
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
      select: { timezone: true, maxBookingHorizonDays: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const today = dateInTimeZone(new Date(), company.timezone);
    const lastDateOffset = Math.min(
      14 - isoWeekday(today),
      company.maxBookingHorizonDays,
    );
    const availableDates = (
      await Promise.all(
        Array.from({ length: lastDateOffset + 1 }, async (_, offset) => {
          const date = addDays(today, offset);
          const availability = await this.scheduling.getAvailability(
            companyId,
            {
              employeeId,
              serviceId,
              date,
            },
          );
          return availability.slots.length > 0 ? date : null;
        }),
      )
    ).filter((date): date is string => date !== null);

    if (availableDates.length === 0) {
      await this.telegramApi.sendMessage(
        token,
        chatId,
        'До конца следующей недели свободного времени нет.',
        new InlineKeyboard().text(
          'Выбрать другого специалиста',
          `s:${encodeUuid(serviceId)}`,
        ),
      );
      return;
    }

    const serviceCode = encodeUuid(serviceId);
    const employeeCode = encodeUuid(employeeId);
    const keyboard = new InlineKeyboard();
    for (const date of availableDates) {
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
    keyboard.text('К услугам', 'b');
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
    });
    if (availability.slots.length === 0) {
      await this.telegramApi.sendMessage(
        token,
        chatId,
        'На эту дату свободного времени нет.',
        new InlineKeyboard()
          .text('В лист ожидания', `w:${encodeUuid(serviceId)}:${encodeUuid(employeeId)}:${date.replaceAll('-', '')}`)
          .row()
          .text('Выбрать другую дату', `e:${encodeUuid(serviceId)}:${encodeUuid(employeeId)}`),
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
    if (context.messageId) {
      await this.telegramApi
        .clearInlineKeyboard(token, context.chatId, context.messageId)
        .catch(() => undefined);
    }
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
        booking.depositStatus === 'PENDING'
          ? `Предоплата: ${booking.depositAmount} ${booking.currency}`
          : null,
      ].filter((line): line is string => Boolean(line)).join('\n'),
      new InlineKeyboard().text('Записаться ещё', 'b').row().text('Мои записи', 'm'),
    );
  }

  private async submitReview(
    companyId: string,
    token: string,
    context: UpdateContext,
    appointmentId: string,
    rating: number,
  ): Promise<void> {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Invalid review rating');
    }
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        companyId,
        status: AppointmentStatus.COMPLETED,
        customer: { telegramId: BigInt(context.user.id) },
      },
      select: { id: true, customerId: true, review: { select: { id: true } } },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.review) {
      await this.telegramApi.sendMessage(token, context.chatId, 'Спасибо — отзыв уже сохранён.');
      return;
    }
    let reviewId: string;
    try {
      const review = await this.prisma.review.create({
        data: {
          companyId,
          customerId: appointment.customerId,
          appointmentId,
          rating,
          commentRequestedAt: new Date(),
        },
        select: { id: true },
      });
      reviewId = review.id;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const review = await this.prisma.review.findUnique({
        where: { appointmentId },
        select: { id: true },
      });
      if (!review) throw error;
      reviewId = review.id;
    }
    if (context.messageId) {
      await this.telegramApi
        .clearInlineKeyboard(token, context.chatId, context.messageId)
        .catch(() => undefined);
    }
    await this.telegramApi.sendMessage(
      token,
      context.chatId,
      `Спасибо за оценку ${rating} из 5! Напишите короткий комментарий одним сообщением.`,
      new InlineKeyboard().text('Без комментария', `vs:${encodeUuid(reviewId)}`),
    );
  }

  private async savePendingReviewComment(
    companyId: string,
    token: string,
    context: UpdateContext,
    comment: string,
  ): Promise<boolean> {
    const review = await this.prisma.review.findFirst({
      where: {
        companyId,
        customer: { telegramId: BigInt(context.user.id) },
        commentRequestedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
      orderBy: { commentRequestedAt: 'desc' },
      select: { id: true },
    });
    if (!review) return false;
    await this.prisma.review.update({
      where: { id_companyId: { id: review.id, companyId } },
      data: { comment: comment.slice(0, 1000), commentRequestedAt: null },
    });
    await this.telegramApi.sendMessage(token, context.chatId, 'Спасибо! Отзыв сохранён.', new InlineKeyboard().text('Главное меню', 'h'));
    return true;
  }

  private async skipReviewComment(
    companyId: string,
    token: string,
    context: UpdateContext,
    reviewId: string,
  ): Promise<void> {
    const result = await this.prisma.review.updateMany({
      where: { id: reviewId, companyId, customer: { telegramId: BigInt(context.user.id) } },
      data: { commentRequestedAt: null },
    });
    if (!result.count) throw new NotFoundException('Review not found');
    if (context.messageId) await this.telegramApi.clearInlineKeyboard(token, context.chatId, context.messageId).catch(() => undefined);
    await this.telegramApi.sendMessage(token, context.chatId, 'Спасибо! Оценка сохранена.', new InlineKeyboard().text('Главное меню', 'h'));
  }

  private appointmentStatusLabel(status: AppointmentStatus): string {
    const labels: Record<AppointmentStatus, string> = {
      PENDING: 'Ожидает подтверждения',
      CONFIRMED: 'Подтверждена',
      COMPLETED: 'Завершена',
      CANCELLED_BY_CUSTOMER: 'Отменена вами',
      CANCELLED_BY_COMPANY: 'Отменена компанией',
      NO_SHOW: 'Клиент не пришёл',
    };
    return labels[status];
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
      select: { timezone: true, maxBookingHorizonDays: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const today = dateInTimeZone(new Date(), company.timezone);
    const lastDate = addDays(
      today,
      Math.min(14 - isoWeekday(today), company.maxBookingHorizonDays),
    );
    if (date < today || date > lastDate) {
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
        messageId: update.callback_query.message.message_id,
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
