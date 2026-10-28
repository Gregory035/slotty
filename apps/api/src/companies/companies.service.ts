import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyRole, LegalAcceptanceSource, LegalDocument, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CompanyResponseDto } from './dto/company-response.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: CreateCompanyDto,
  ): Promise<CompanyResponseDto> {
    const name = this.requireTrimmedName(input.name);
    const timezone = input.timezone ?? 'Europe/Moscow';
    this.assertTimezone(timezone);

    return this.prisma.$transaction(async (transaction) => {
      const company = await transaction.company.create({
        data: {
          name,
          description: this.optionalTrimmed(input.description),
          phone: this.optionalTrimmed(input.phone),
          email: input.email?.trim().toLowerCase(),
          address: this.optionalTrimmed(input.address),
          timezone,
          currency: input.currency ?? 'RUB',
          language: input.language ?? 'ru',
        },
      });
      await transaction.companyMember.create({
        data: {
          companyId: company.id,
          userId,
          role: CompanyRole.OWNER,
        },
      });
      await transaction.legalAcceptance.create({
        data: {
          userId,
          companyId: company.id,
          document: LegalDocument.DATA_PROCESSING,
          version: input.legalVersion,
          source: LegalAcceptanceSource.COMPANY_ONBOARDING,
        },
      });
      const subscription = await transaction.subscription.create({
        data: {
          companyId: company.id,
          plan: SubscriptionPlan.TRIAL,
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: new Date(Date.now() + TRIAL_LENGTH_MS),
        },
      });
      await transaction.auditLog.create({
        data: {
          companyId: company.id,
          actorId: userId,
          action: 'company.created',
          entityType: 'Company',
          entityId: company.id,
        },
      });

      return this.toResponse(company, CompanyRole.OWNER, subscription, null);
    });
  }

  async findAllForUser(userId: string): Promise<CompanyResponseDto[]> {
    const memberships = await this.prisma.companyMember.findMany({
      where: { userId, company: { deletedAt: null } },
      include: {
        company: {
          include: {
            subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map(({ company, role, employeeId }) =>
      this.toResponse(company, role, company.subscriptions[0] ?? null, employeeId),
    );
  }

  async findById(
    companyId: string,
    role: CompanyRole,
    employeeId: string | null = null,
  ): Promise<CompanyResponseDto> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      include: {
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return this.toResponse(company, role, company.subscriptions[0] ?? null, employeeId);
  }

  async update(
    companyId: string,
    role: CompanyRole,
    input: UpdateCompanyDto,
    actorId?: string,
  ): Promise<CompanyResponseDto> {
    if (input.timezone) {
      this.assertTimezone(input.timezone);
    }

    const normalizedSlug = input.publicSlug?.trim().toLowerCase();
    const company = await this.prisma.$transaction(async (tx) => {
      if (normalizedSlug) {
        const occupied = await tx.company.findFirst({
          where: { publicSlug: normalizedSlug, id: { not: companyId } },
          select: { id: true },
        });
        if (occupied) throw new ConflictException('Этот публичный адрес уже занят');
      }
      const changed = await tx.company.update({
        where: { id: companyId },
        data: {
        ...(input.name !== undefined
          ? { name: this.requireTrimmedName(input.name) }
          : {}),
        ...(input.description !== undefined
          ? { description: this.optionalTrimmed(input.description) }
          : {}),
        ...(input.phone !== undefined
          ? { phone: this.optionalTrimmed(input.phone) }
          : {}),
        ...(input.email !== undefined
          ? { email: input.email?.trim().toLowerCase() || null }
          : {}),
        ...(input.address !== undefined
          ? { address: this.optionalTrimmed(input.address) }
          : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
          ...(input.minBookingNoticeMinutes !== undefined ? { minBookingNoticeMinutes: input.minBookingNoticeMinutes } : {}),
          ...(input.maxBookingHorizonDays !== undefined ? { maxBookingHorizonDays: input.maxBookingHorizonDays } : {}),
          ...(input.slotStepMinutes !== undefined ? { slotStepMinutes: input.slotStepMinutes } : {}),
          ...(input.cancellationNoticeMinutes !== undefined ? { cancellationNoticeMinutes: input.cancellationNoticeMinutes } : {}),
          ...(input.allowAnyEmployee !== undefined ? { allowAnyEmployee: input.allowAnyEmployee } : {}),
          ...(input.rebookingDelayDays !== undefined ? { rebookingDelayDays: input.rebookingDelayDays } : {}),
          ...(input.publicSlug !== undefined ? { publicSlug: normalizedSlug || null } : {}),
          ...(input.publicBookingEnabled !== undefined ? { publicBookingEnabled: input.publicBookingEnabled } : {}),
        },
        include: {
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (actorId) {
        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            action: 'company.updated',
            entityType: 'Company',
            entityId: companyId,
            metadata: { fields: Object.keys(input) },
          },
        });
      }
      return changed;
    });

    return this.toResponse(company, role, company.subscriptions[0] ?? null);
  }

  async findPublicBySlug(slug: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        publicSlug: slug.trim().toLowerCase(),
        publicBookingEnabled: true,
        deletedAt: null,
      },
      select: {
        name: true,
        description: true,
        phone: true,
        email: true,
        address: true,
        timezone: true,
        currency: true,
        logoUrl: true,
        publicSlug: true,
        bots: {
          where: { status: 'ACTIVE' },
          select: { username: true },
          take: 1,
        },
        services: {
          where: { isActive: true, deletedAt: null },
          select: {
            id: true,
            name: true,
            description: true,
            durationMinutes: true,
            price: true,
            category: true,
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
                    workExamples: {
                      where: { publishedAt: { not: null }, OR: [{ storageKey: { not: null } }, { imageData: { not: null } }] },
                      select: { id: true, caption: true },
                      orderBy: { publishedAt: 'desc' },
                      take: 8,
                    },
                    appointments: {
                      where: { review: { isNot: null } },
                      select: { review: { select: { rating: true, comment: true, createdAt: true, customer: { select: { firstName: true } } } } },
                      orderBy: { startsAt: 'desc' },
                      take: 20,
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        },
      },
    });
    if (!company) throw new NotFoundException('Public company page not found');
    return {
      ...company,
      currency: company.currency.trim(),
      botUsername: company.bots[0]?.username ?? null,
      bots: undefined,
      services: company.services.map((service) => ({
        ...service,
        price: service.price.toFixed(2),
        employees: service.employees.map(({ employee }) => {
          const reviews = employee.appointments.flatMap(({ review }) => review ? [{
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
            customerName: review.customer.firstName,
          }] : []);
          return {
            id: employee.id,
            name: [employee.firstName, employee.lastName].filter(Boolean).join(' '),
            photoUrl: employee.photoUrl,
            description: employee.description,
            rating: reviews.length ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)) : 0,
            reviews,
            workExamples: employee.workExamples,
          };
        }),
      })),
    };
  }

  findMembership(userId: string, companyId: string) {
    return this.prisma.companyMember.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { company: { select: { deletedAt: true } } },
    });
  }

  async softDelete(companyId: string, actorId: string): Promise<void> {
    const deletedAt = new Date();
    const changed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.company.updateMany({
        where: { id: companyId, deletedAt: null },
        data: { deletedAt },
      });
      if (result.count !== 1) return false;
      await tx.bot.updateMany({
        where: { companyId },
        data: { status: 'DISABLED' },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'company.deleted',
          entityType: 'Company',
          entityId: companyId,
        },
      });
      return true;
    });
    if (!changed) throw new NotFoundException('Company not found');
  }

  private toResponse(
    company: {
      id: string;
      name: string;
      description: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
      timezone: string;
      currency: string;
      language: string;
      logoUrl: string | null;
      publicSlug: string | null;
      publicBookingEnabled: boolean;
      minBookingNoticeMinutes: number;
      maxBookingHorizonDays: number;
      slotStepMinutes: number;
      cancellationNoticeMinutes: number;
      allowAnyEmployee: boolean;
      rebookingDelayDays: number;
      createdAt: Date;
      updatedAt: Date;
    },
    role: CompanyRole,
    subscription: {
      plan: SubscriptionPlan;
      status: SubscriptionStatus;
      trialEndsAt: Date | null;
    } | null,
    employeeId: string | null = null,
  ): CompanyResponseDto {
    return {
      id: company.id,
      name: company.name,
      description: company.description,
      phone: company.phone,
      email: company.email,
      address: company.address,
      timezone: company.timezone,
      currency: company.currency,
      language: company.language,
      logoUrl: company.logoUrl,
      publicSlug: company.publicSlug,
      publicBookingEnabled: company.publicBookingEnabled,
      minBookingNoticeMinutes: company.minBookingNoticeMinutes,
      maxBookingHorizonDays: company.maxBookingHorizonDays,
      slotStepMinutes: company.slotStepMinutes,
      cancellationNoticeMinutes: company.cancellationNoticeMinutes,
      allowAnyEmployee: company.allowAnyEmployee,
      rebookingDelayDays: company.rebookingDelayDays,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      role,
      employeeId,
      subscriptionPlan: subscription?.plan ?? null,
      subscriptionStatus: subscription?.status ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
    };
  }

  private requireTrimmedName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Company name cannot be empty');
    }
    return trimmed;
  }

  private optionalTrimmed(value?: string): string | undefined {
    return value === undefined ? undefined : value.trim();
  }

  private assertTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException('Timezone must be a valid IANA timezone');
    }
  }
}
