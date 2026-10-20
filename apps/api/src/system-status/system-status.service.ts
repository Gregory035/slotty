import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { PrismaService } from '../database/prisma.service';

export interface BackupStatus {
  state: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt?: string;
  file?: string;
  remote?: boolean;
}

@Injectable()
export class SystemStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [bot, subscription, notificationCounts, outboxCounts, updateCounts, paymentCounts, lastPayment] = await Promise.all([
      this.prisma.bot.findUnique({
        where: { companyId },
        select: { username: true, status: true, errorMessage: true, updatedAt: true },
      }),
      this.prisma.subscription.findFirst({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        select: { plan: true, status: true, autoRenewEnabled: true, cancelAtPeriodEnd: true, currentPeriodEndsAt: true, graceEndsAt: true },
      }),
      this.prisma.notification.groupBy({ where: { companyId }, by: ['status'], _count: { _all: true } }),
      this.prisma.outboxEvent.groupBy({ where: { companyId }, by: ['status'], _count: { _all: true } }),
      this.prisma.telegramUpdate.groupBy({ where: { companyId }, by: ['status'], _count: { _all: true } }),
      this.prisma.payment.groupBy({ where: { companyId, createdAt: { gte: since } }, by: ['status'], _count: { _all: true } }),
      this.prisma.payment.findFirst({
        where: { companyId }, orderBy: { createdAt: 'desc' },
        select: { status: true, amount: true, currency: true, createdAt: true, paidAt: true, receiptStatus: true },
      }),
    ]);
    return {
      checkedAt: new Date().toISOString(),
      integrations: {
        passwordRecovery: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.PASSWORD_RESET_FROM_EMAIL?.trim()),
        errorTracking: Boolean(process.env.SENTRY_DSN?.trim()),
        workExamplesStorage: process.env.WORK_EXAMPLES_STORAGE === 's3'
          ? Boolean(process.env.S3_BUCKET?.trim() && process.env.S3_ACCESS_KEY_ID?.trim() && process.env.S3_SECRET_ACCESS_KEY?.trim())
          : true,
        paymentProvider: Boolean(process.env.YOOKASSA_SHOP_ID?.trim() && process.env.YOOKASSA_SECRET_KEY?.trim()),
        offsiteBackup: Boolean(process.env.BACKUP_REMOTE_CONFIGURED === 'true'),
      },
      bot: bot ? { ...bot, webhookConfigured: bot.status === 'ACTIVE' } : null,
      queues: {
        notifications: Object.fromEntries(notificationCounts.map((item) => [item.status, item._count._all])),
        outbox: Object.fromEntries(outboxCounts.map((item) => [item.status, item._count._all])),
        telegram: Object.fromEntries(updateCounts.map((item) => [item.status, item._count._all])),
      },
      billing: {
        subscription,
        paymentsLast30Days: Object.fromEntries(paymentCounts.map((item) => [item.status, item._count._all])),
        lastPayment: lastPayment ? { ...lastPayment, amount: lastPayment.amount.toFixed(2) } : null,
      },
      backup: await this.readBackupStatus(),
    };
  }

  private async readBackupStatus(): Promise<BackupStatus | null> {
    try {
      const raw = await readFile(process.env.BACKUP_STATUS_FILE?.trim() || '/backups/latest-status.json', 'utf8');
      const parsed = JSON.parse(raw) as BackupStatus;
      return ['running', 'success', 'failed'].includes(parsed.state) ? parsed : null;
    } catch {
      return null;
    }
  }
}
