import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BotStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppointmentsService, TelegramCustomerInput } from '../appointments/appointments.service';
import { PrismaService } from '../database/prisma.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { MiniAppAvailabilityDto, MiniAppBookingDto } from './dto/mini-app.dto';
import { TokenEncryptionService } from './token-encryption.service';

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
  ) {}

  async getSession(companyId: string, initData: string) {
    await this.authenticate(companyId, initData);
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        name: true,
        description: true,
        timezone: true,
        currency: true,
        logoUrl: true,
        maxBookingHorizonDays: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');

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
                  where: { publishedAt: { not: null }, imageData: { not: null } },
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
    await this.authenticate(companyId, input.initData);
    return this.scheduling.getAvailability(companyId, {
      serviceId: input.serviceId,
      employeeId: input.employeeId,
      date: input.date,
    });
  }

  async createBooking(companyId: string, input: MiniAppBookingDto) {
    const user = await this.authenticate(companyId, input.initData);
    return this.appointments.createFromTelegram(
      companyId,
      this.customerInput(user),
      input.employeeId,
      input.serviceId,
      input.date,
      input.time,
    );
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
