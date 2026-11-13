import { BadRequestException, Controller, ForbiddenException, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUserDto } from '../auth/dto/auth-response.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { PrismaService } from '../database/prisma.service';
import { activationSteps, bookableAssignment } from '../dashboard/activation';
import { RateLimits } from '../rate-limit/rate-limit.decorator';

const operatorLimit = {
  name: 'operator-read', identity: 'user_company',
  limitEnv: 'RATE_LIMIT_OPERATOR_MAX', windowEnv: 'RATE_LIMIT_OPERATOR_WINDOW_SECONDS',
  defaultLimit: 60, defaultWindowSeconds: 60,
} as const;

export function isSlottyOperator(userId: string, configuredIds: string | undefined): boolean {
  return Boolean(userId && configuredIds?.split(',').some((id) => id.trim() === userId));
}

@Controller('operator')
@UseGuards(AccessTokenGuard)
export class OperatorController {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  @Get('users')
  @RateLimits(operatorLimit)
  @Header('Cache-Control', 'no-store')
  async users(@CurrentUser() actor: AuthenticatedUserDto, @Query('q') query?: string, @Query('page') rawPage?: string) {
    if (!isSlottyOperator(actor.id, this.config.get<string>('SLOTTY_OPERATOR_USER_IDS'))) {
      throw new ForbiddenException('Operator access required');
    }
    if (query !== undefined && (typeof query !== 'string' || query.length > 100)) throw new BadRequestException('Invalid search');
    if (rawPage !== undefined && (typeof rawPage !== 'string' || !/^\d{1,5}$/.test(rawPage))) throw new BadRequestException('Invalid page');
    const page = Number(rawPage ?? 1);
    if (page < 1) throw new BadRequestException('Invalid page');
    const q = query?.trim();
    const where = q ? { OR: ['email', 'firstName', 'lastName'].map((field) => ({ [field]: { contains: q, mode: 'insensitive' as const } })) } : {};
    const rows = await this.prisma.user.findMany({
      where, skip: (page - 1) * 25, take: 26,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, email: true, firstName: true, lastName: true, createdAt: true,
        memberships: { where: { company: { deletedAt: null } }, select: {
          role: true, company: { select: {
            id: true, name: true,
            subscriptions: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { plan: true, status: true } },
            _count: { select: {
              employeeServices: { where: bookableAssignment },
              bots: { where: { status: 'ACTIVE' } },
              appointments: { where: { source: 'TELEGRAM' } },
            } },
          } },
        } },
      },
    });
    return { page, hasNext: rows.length > 25, users: rows.slice(0, 25).map(({ memberships, ...user }) => ({
      ...user, companies: memberships.map(({ role, company }) => ({
        id: company.id, name: company.name, role, subscription: company.subscriptions[0] ?? null,
        scheduleReady: company._count.employeeServices > 0, botReady: company._count.bots > 0, receivedBooking: company._count.appointments > 0,
      })),
    })) };
  }

  @Get('activation')
  @RateLimits(operatorLimit)
  @Header('Cache-Control', 'no-store')
  async activation(@CurrentUser() actor: AuthenticatedUserDto) {
    if (!isSlottyOperator(actor.id, this.config.get<string>('SLOTTY_OPERATOR_USER_IDS'))) {
      throw new ForbiddenException('Operator access required');
    }
    const registered = await this.prisma.user.count();
    const steps = await Promise.all(activationSteps.map(async ({ id, label, where }) => ({
      id, label, count: await this.prisma.user.count({ where: { memberships: { some: { role: 'OWNER', company: { deletedAt: null, ...where } } } } }),
    })));
    return [{ id: 'registered', label: 'Зарегистрировались', count: registered }, ...steps];
  }
}
