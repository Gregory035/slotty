import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyRole, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
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
      const subscription = await transaction.subscription.create({
        data: {
          companyId: company.id,
          plan: SubscriptionPlan.TRIAL,
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: new Date(Date.now() + TRIAL_LENGTH_MS),
        },
      });

      return this.toResponse(company, CompanyRole.OWNER, subscription);
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

    return memberships.map(({ company, role }) =>
      this.toResponse(company, role, company.subscriptions[0] ?? null),
    );
  }

  async findById(
    companyId: string,
    role: CompanyRole,
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

    return this.toResponse(company, role, company.subscriptions[0] ?? null);
  }

  async update(
    companyId: string,
    role: CompanyRole,
    input: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    if (input.timezone) {
      this.assertTimezone(input.timezone);
    }

    const company = await this.prisma.company.update({
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
          ? { email: input.email.trim().toLowerCase() }
          : {}),
        ...(input.address !== undefined
          ? { address: this.optionalTrimmed(input.address) }
          : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
      },
      include: {
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    return this.toResponse(company, role, company.subscriptions[0] ?? null);
  }

  findMembership(userId: string, companyId: string) {
    return this.prisma.companyMember.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { company: { select: { deletedAt: true } } },
    });
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
      createdAt: Date;
      updatedAt: Date;
    },
    role: CompanyRole,
    subscription: {
      plan: SubscriptionPlan;
      status: SubscriptionStatus;
      trialEndsAt: Date | null;
    } | null,
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
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      role,
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
