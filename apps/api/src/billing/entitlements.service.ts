import { catalog } from './catalog';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface PlanLimits {
  employees: number;
  services: number;
  monthlyAppointments: number;
  bots: number;
  analytics: boolean;
  customNotifications: boolean;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  FREE: {
    employees: catalog.FREE.staff,
    services: 10,
    monthlyAppointments: catalog.FREE.limit ?? Number.MAX_SAFE_INTEGER,
    bots: 1,
    analytics: false,
    customNotifications: false,
  },
  TEAM: {
    employees: catalog.TEAM.staff,
    services: 50,
    monthlyAppointments: catalog.TEAM.limit ?? Number.MAX_SAFE_INTEGER,
    bots: 1,
    analytics: true,
    customNotifications: false,
  },
  BUSINESS: {
    employees: catalog.BUSINESS.staff,
    services: 500,
    monthlyAppointments: catalog.BUSINESS.limit ?? Number.MAX_SAFE_INTEGER,
    bots: 5,
    analytics: true,
    customNotifications: true,
  },
  SOLO: { employees: catalog.SOLO.staff, services: 50, monthlyAppointments: catalog.SOLO.limit ?? Number.MAX_SAFE_INTEGER, bots: 1, analytics: false, customNotifications: true },
};

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) this.denied('Подписка для компании не настроена');
    const active = this.isActive(subscription);
    const limits = PLAN_LIMITS[subscription.plan];
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const [employees, services, monthlyAppointments, bots] = await Promise.all([
      this.prisma.employee.count({ where: { companyId, deletedAt: null } }),
      this.prisma.service.count({ where: { companyId, deletedAt: null } }),
      this.prisma.appointment.count({ where: { companyId, createdAt: { gte: monthStart } } }),
      this.prisma.bot.count({ where: { companyId } }),
    ]);
    return {
      plan: subscription.plan,
      status: subscription.status,
      active,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEndsAt: subscription.currentPeriodEndsAt,
      graceEndsAt: subscription.graceEndsAt,
      autoRenewEnabled: subscription.autoRenewEnabled,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      paymentMethodSaved: Boolean(subscription.providerPaymentMethodId),
      limits,
      usage: { employees, services, monthlyAppointments, bots },
    };
  }

  async assertCanCreateEmployee(companyId: string): Promise<void> {
    const value = await this.get(companyId);
    this.assertActive(value.active);
    if (value.usage.employees >= value.limits.employees) this.denied('Достигнут лимит сотрудников на текущем тарифе');
  }

  async assertCanCreateService(companyId: string): Promise<void> {
    const value = await this.get(companyId);
    this.assertActive(value.active);
    if (value.usage.services >= value.limits.services) this.denied('Достигнут лимит услуг на текущем тарифе');
  }

  async assertCanCreateAppointment(companyId: string, count = 1): Promise<void> {
    const value = await this.get(companyId);
    this.assertActive(value.active);
    if (value.usage.monthlyAppointments + count > value.limits.monthlyAppointments) {
      this.denied('Достигнут месячный лимит записей на текущем тарифе');
    }
  }

  async assertCanConnectBot(companyId: string): Promise<void> {
    const value = await this.get(companyId);
    this.assertActive(value.active);
    if (value.usage.bots >= value.limits.bots) this.denied('Достигнут лимит Telegram-ботов на текущем тарифе');
  }

  private isActive(subscription: {
    status: SubscriptionStatus;
    trialEndsAt: Date | null;
    currentPeriodEndsAt: Date | null;
    graceEndsAt: Date | null;
  }): boolean {
    const now = Date.now();
    if (subscription.status === SubscriptionStatus.TRIALING) {
      return Boolean(subscription.trialEndsAt && subscription.trialEndsAt.getTime() > now);
    }
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return !subscription.currentPeriodEndsAt || subscription.currentPeriodEndsAt.getTime() > now;
    }
    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      return Boolean(subscription.graceEndsAt && subscription.graceEndsAt.getTime() > now);
    }
    return false;
  }

  private assertActive(active: boolean): void {
    if (!active) this.denied('Пробный период или подписка завершены. Выберите тариф, чтобы продолжить работу');
  }

  private denied(message: string): never {
    throw new HttpException(message, HttpStatus.PAYMENT_REQUIRED);
  }
}
