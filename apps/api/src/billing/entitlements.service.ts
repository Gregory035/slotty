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
  TRIAL: {
    employees: 3,
    services: 10,
    monthlyAppointments: 100,
    bots: 1,
    analytics: false,
    customNotifications: false,
  },
  STARTER: {
    employees: 10,
    services: 50,
    monthlyAppointments: 1000,
    bots: 1,
    analytics: false,
    customNotifications: false,
  },
  PRO: {
    employees: 100,
    services: 500,
    monthlyAppointments: 10000,
    bots: 5,
    analytics: true,
    customNotifications: true,
  },
};

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) this.denied('Subscription is not configured');
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
      limits,
      usage: { employees, services, monthlyAppointments, bots },
    };
  }

  async assertCanCreateEmployee(companyId: string): Promise<void> {
    const value = await this.get(companyId);
    this.assertActive(value.active);
    if (value.usage.employees >= value.limits.employees) this.denied('Employee limit reached');
  }

  async assertCanCreateService(companyId: string): Promise<void> {
    const value = await this.get(companyId);
    this.assertActive(value.active);
    if (value.usage.services >= value.limits.services) this.denied('Service limit reached');
  }

  async assertCanCreateAppointment(companyId: string): Promise<void> {
    const value = await this.get(companyId);
    this.assertActive(value.active);
    if (value.usage.monthlyAppointments >= value.limits.monthlyAppointments) {
      this.denied('Monthly appointment limit reached');
    }
  }

  async assertCanConnectBot(companyId: string): Promise<void> {
    const value = await this.get(companyId);
    this.assertActive(value.active);
    if (value.usage.bots >= value.limits.bots) this.denied('Telegram bot limit reached');
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
    if (!active) this.denied('Subscription is inactive');
  }

  private denied(message: string): never {
    throw new HttpException(message, HttpStatus.PAYMENT_REQUIRED);
  }
}
