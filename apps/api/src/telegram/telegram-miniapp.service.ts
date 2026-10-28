import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AppointmentStatus, BookingFunnelStep, BotStatus, LegalAcceptanceSource, LegalDocument, Prisma, WorkExampleSource } from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { AppointmentsService, TelegramCustomerInput } from '../appointments/appointments.service';
import { PrismaService } from '../database/prisma.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { localDateTimeToUtc } from '../scheduling/time-zone.util';
import { MiniAppAppointmentDto, MiniAppAvailabilityDto, MiniAppBookingDto, MiniAppRescheduleDto, MiniAppReviewDto, MiniAppVisitBookingDto, MiniAppWorkPhotoDto } from './dto/mini-app.dto';
import { TokenEncryptionService } from './token-encryption.service';
import { WorkImageStorageService } from '../employees/work-image-storage.service';

interface TelegramMiniAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

/**
 * A public Mini App must not trust the company id or Telegram user supplied by
 * the browser. Telegram signs initData with the bot token, and this service
 * verifies that signature before every customer-facing operation.
 */
@Injectable()
export class TelegramMiniAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly appointments: AppointmentsService,
    private readonly encryption: TokenEncryptionService,
    private readonly workImages: WorkImageStorageService,
  ) {}

  async getSession(companyId: string, initData: string) {
    const user = await this.authenticate(companyId, initData);
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        name: true,
        description: true,
        timezone: true,
        currency: true,
        logoUrl: true,
        maxBookingHorizonDays: true,
        cancellationNoticeMinutes: true,
        allowAnyEmployee: true,
        workingMode: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    await this.recordEvent(companyId, user.id, BookingFunnelStep.STARTED);

    const services = await this.prisma.service.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        category: true,
        photoUrl: true,
        employees: {
          where: { employee: { isActive: true, deletedAt: null } },
          select: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
                description: true,
                color: true,
                workExamples: {
                  where: { publishedAt: { not: null }, OR: [{ storageKey: { not: null } }, { imageData: { not: null } }] },
                  select: { id: true, caption: true, publishedAt: true },
                  orderBy: { publishedAt: 'desc' },
                  take: 20,
                },
                appointments: {
                  where: { review: { isNot: null } },
                  select: {
                    review: { select: { id: true, rating: true, comment: true, createdAt: true, customer: { select: { firstName: true } } } },
                  },
                  orderBy: { startsAt: 'desc' },
                  take: 20,
                },
              },
            },
          },
          orderBy: { employee: { firstName: 'asc' } },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return {
      company,
      services: services.map((service) => ({
        ...service,
        price: service.price.toFixed(2),
        employees: service.employees.map(({ employee }) => {
          const reviews = employee.appointments.flatMap(({ review }) => review ? [{ ...review, customerName: review.customer.firstName }] : []);
          const rating = reviews.length ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)) : 0;
          return {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            name: [employee.firstName, employee.lastName].filter(Boolean).join(' '),
            photoUrl: employee.photoUrl,
            description: employee.description,
            color: employee.color,
            rating,
            reviewsCount: reviews.length,
            reviews,
            workExamples: employee.workExamples,
          };
        }),
      })),
    };
  }

  async getAvailability(companyId: string, input: MiniAppAvailabilityDto) {
    const user = await this.authenticate(companyId, input.initData);
    await this.recordEvent(companyId, user.id, BookingFunnelStep.DATE_SELECTED);
    if (input.employeeId) {
      return this.scheduling.getAvailability(companyId, {
        serviceId: input.serviceId,
        employeeId: input.employeeId,
        date: input.date,
      });
    }
    const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null }, select: { allowAnyEmployee: true } });
    if (!company?.allowAnyEmployee) throw new BadRequestException('Выберите специалиста');
    const assignments = await this.prisma.employeeService.findMany({
      where: { companyId, serviceId: input.serviceId, employee: { isActive: true, deletedAt: null } },
      select: { employeeId: true },
      orderBy: { employee: { firstName: 'asc' } },
    });
    const availability = await Promise.all(assignments.map(({ employeeId }) =>
      this.scheduling.getAvailability(companyId, { serviceId: input.serviceId, employeeId, date: input.date }),
    ));
    return {
      date: input.date,
      timezone: availability[0]?.timezone ?? 'Europe/Moscow',
      employeeId: null,
      serviceId: input.serviceId,
      durationMinutes: availability[0]?.durationMinutes ?? 0,
      slots: availability.flatMap((item) => item.slots.map((slot) => ({ ...slot, employeeId: item.employeeId })))
        .sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    };
  }

  async createBooking(companyId: string, input: MiniAppBookingDto) {
    const user = await this.authenticate(companyId, input.initData);
    await this.recordBookingConsent(companyId, user.id, input.legalVersion);
    const result = await this.appointments.createFromTelegram(
      companyId,
      this.customerInput(user),
      input.employeeId,
      input.serviceId,
      input.date,
      input.time,
    );
    await this.recordEvent(companyId, user.id, BookingFunnelStep.BOOKED);
    return result;
  }

  async createVisit(companyId: string, input: MiniAppVisitBookingDto) {
    const user = await this.authenticate(companyId, input.initData);
    await this.recordBookingConsent(companyId, user.id, input.legalVersion);
    const result = await this.appointments.createVisitFromTelegram(
      companyId, this.customerInput(user), input.items, input.requestId,
    );
    await this.recordEvent(companyId, user.id, BookingFunnelStep.BOOKED);
    return result;
  }

  async recordFunnelEvent(companyId: string, initData: string, step: BookingFunnelStep) {
    const user = await this.authenticate(companyId, initData);
    await this.recordEvent(companyId, user.id, step);
    return { ok: true };
  }

  async listAppointments(companyId: string, initData: string) {
    const user = await this.authenticate(companyId, initData);
    const customer = await this.prisma.customer.findUnique({
      where: { companyId_telegramId: { companyId, telegramId: BigInt(user.id) } },
      select: { id: true },
    });
    if (!customer) return { upcoming: [], history: [] };
    const rows = await this.prisma.appointment.findMany({
      where: { companyId, customerId: customer.id },
      include: { service: true, employee: true, review: true, workExample: { select: { publishedAt: true } } },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    const now = new Date();
    const items = rows.map((appointment) => ({
      id: appointment.id,
      serviceId: appointment.serviceId,
      employeeId: appointment.employeeId,
      serviceName: appointment.service.name,
      employeeName: [appointment.employee.firstName, appointment.employee.lastName].filter(Boolean).join(' '),
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      status: appointment.status,
      price: appointment.priceSnapshot.toFixed(2),
      review: appointment.review ? { rating: appointment.review.rating, comment: appointment.review.comment } : null,
      hasWorkPhoto: Boolean(appointment.workExample?.publishedAt),
    }));
    const activeStatuses: AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
    return {
      upcoming: items.filter((item) => new Date(item.startsAt) >= now && activeStatuses.includes(item.status)),
      history: items.filter((item) => new Date(item.startsAt) < now || !activeStatuses.includes(item.status)),
    };
  }

  async cancelAppointment(companyId: string, input: MiniAppAppointmentDto) {
    const user = await this.authenticate(companyId, input.initData);
    const appointment = await this.requireCustomerAppointment(companyId, input.appointmentId, user.id);
    const cutoff = appointment.startsAt.getTime() - appointment.company.cancellationNoticeMinutes * 60_000;
    if (Date.now() > cutoff) throw new ConflictException('Онлайн-отмена уже недоступна. Свяжитесь с компанией.');
    return this.appointments.updateStatus(companyId, appointment.id, { status: AppointmentStatus.CANCELLED_BY_CUSTOMER });
  }

  async rescheduleAppointment(companyId: string, input: MiniAppRescheduleDto) {
    const user = await this.authenticate(companyId, input.initData);
    const appointment = await this.requireCustomerAppointment(companyId, input.appointmentId, user.id);
    const startsAt = localDateTimeToUtc(input.date, input.time, appointment.company.timezone);
    return this.appointments.reschedule(companyId, appointment.id, { startsAt: startsAt.toISOString() });
  }

  async submitReview(companyId: string, input: MiniAppReviewDto) {
    const user = await this.authenticate(companyId, input.initData);
    const appointment = await this.requireCompletedCustomerAppointment(companyId, input.appointmentId, user.id);
    if (appointment.review) throw new ConflictException('Отзыв для этой записи уже оставлен');
    try {
      return await this.prisma.review.create({
        data: {
          companyId,
          customerId: appointment.customerId,
          appointmentId: appointment.id,
          rating: input.rating,
          comment: input.comment?.trim() || null,
        },
        select: { rating: true, comment: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Отзыв для этой записи уже оставлен');
      }
      throw error;
    }
  }

  async uploadWorkPhoto(
    companyId: string,
    input: MiniAppWorkPhotoDto,
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    const user = await this.authenticate(companyId, input.initData);
    const appointment = await this.requireCompletedCustomerAppointment(companyId, input.appointmentId, user.id);
    if (!file) throw new BadRequestException('Выберите фотографию');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) || file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Поддерживаются JPG, PNG или WebP до 5 МБ');
    }
    const previous = await this.prisma.workExample.findUnique({
      where: { appointmentId_companyId: { appointmentId: appointment.id, companyId } },
      select: { storageKey: true, thumbnailKey: true },
    });
    const stored = await this.workImages.store(companyId, file.buffer);
    try {
      const work = await this.prisma.workExample.upsert({
        where: { appointmentId_companyId: { appointmentId: appointment.id, companyId } },
        update: {
          source: WorkExampleSource.CUSTOMER,
          employeeId: appointment.employeeId,
          customerId: appointment.customerId,
          imageData: null,
          storageKey: stored.storageKey,
          thumbnailKey: stored.thumbnailKey,
          mimeType: stored.mimeType,
          publishedAt: new Date(),
          uploadRequestedAt: null,
          consentConfirmedAt: new Date(),
          consentVersion: input.consentVersion,
          consentSource: 'TELEGRAM_MINI_APP',
        },
        create: {
          companyId,
          employeeId: appointment.employeeId,
          appointmentId: appointment.id,
          customerId: appointment.customerId,
          source: WorkExampleSource.CUSTOMER,
          storageKey: stored.storageKey,
          thumbnailKey: stored.thumbnailKey,
          mimeType: stored.mimeType,
          publishedAt: new Date(),
          consentConfirmedAt: new Date(),
          consentVersion: input.consentVersion,
          consentSource: 'TELEGRAM_MINI_APP',
        },
        select: { id: true },
      });
      await this.workImages.remove(previous?.storageKey, previous?.thumbnailKey);
      return work;
    } catch (error) {
      await this.workImages.remove(stored.storageKey, stored.thumbnailKey);
      throw error;
    }
  }

  private async requireCompletedCustomerAppointment(companyId: string, appointmentId: string, telegramId: number) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId, status: AppointmentStatus.COMPLETED, customer: { telegramId: BigInt(telegramId) } },
      select: { id: true, customerId: true, employeeId: true, review: { select: { id: true } } },
    });
    if (!appointment) throw new NotFoundException('Отзыв и фото доступны только после подтверждённого завершения услуги');
    return appointment;
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
    if (!appointment) throw new NotFoundException('Запись не найдена');
    return appointment;
  }

  private async recordEvent(companyId: string, telegramId: number, step: BookingFunnelStep) {
    const visitorKey = createHash('sha256').update(`${companyId}:${telegramId}`).digest('hex');
    await this.prisma.bookingFunnelEvent.create({ data: { companyId, visitorKey, step } }).catch(() => undefined);
  }

  private async recordBookingConsent(companyId: string, telegramId: number, version: string) {
    await this.prisma.legalAcceptance.createMany({
      data: [LegalDocument.PRIVACY, LegalDocument.PERSONAL_DATA].map((document) => ({
        companyId,
        telegramId: BigInt(telegramId),
        document,
        version,
        source: LegalAcceptanceSource.TELEGRAM_MINI_APP,
      })),
    });
  }

  private async authenticate(companyId: string, initData: string): Promise<TelegramMiniAppUser> {
    if (!initData || initData.length > 4096) {
      throw new UnauthorizedException('Telegram Mini App authorization is required');
    }
    const bot = await this.prisma.bot.findFirst({
      where: { companyId, status: BotStatus.ACTIVE },
      select: { tokenEncrypted: true },
    });
    if (!bot) throw new NotFoundException('Active Telegram bot not found');

    const params = new URLSearchParams(initData);
    const entries = [...params.entries()];
    const seen = new Set<string>();
    for (const [key] of entries) {
      if (seen.has(key)) throw new UnauthorizedException('Invalid Telegram Mini App authorization');
      seen.add(key);
    }
    const hash = params.get('hash');
    const authDate = Number(params.get('auth_date'));
    const rawUser = params.get('user');
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || !Number.isSafeInteger(authDate) || !rawUser) {
      throw new UnauthorizedException('Invalid Telegram Mini App authorization');
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (authDate > nowSeconds + 300 || nowSeconds - authDate > 86_400) {
      throw new UnauthorizedException('Telegram Mini App authorization has expired');
    }

    const dataCheckString = entries
      .filter(([key]) => key !== 'hash')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const token = this.encryption.decrypt(bot.tokenEncrypted);
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');
    if (!timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expected, 'hex'))) {
      throw new UnauthorizedException('Invalid Telegram Mini App authorization');
    }

    let user: unknown;
    try {
      user = JSON.parse(rawUser);
    } catch {
      throw new UnauthorizedException('Invalid Telegram Mini App user');
    }
    if (!this.isTelegramUser(user)) {
      throw new UnauthorizedException('Invalid Telegram Mini App user');
    }
    return user;
  }

  private isTelegramUser(value: unknown): value is TelegramMiniAppUser {
    if (!value || typeof value !== 'object') return false;
    const user = value as Record<string, unknown>;
    return Number.isSafeInteger(user.id) && Number(user.id) > 0 && typeof user.first_name === 'string';
  }

  private customerInput(user: TelegramMiniAppUser): TelegramCustomerInput {
    return {
      telegramId: user.id,
      firstName: user.first_name,
      ...(typeof user.last_name === 'string' ? { lastName: user.last_name } : {}),
      ...(typeof user.username === 'string' ? { username: user.username } : {}),
    };
  }
}
