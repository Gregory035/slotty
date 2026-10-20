import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MetricsService {
  private requestCount = 0;
  private errorCount = 0;
  private latencyTotalMs = 0;
  private bookingConflicts = 0;

  constructor(private readonly prisma: PrismaService) {}

  async recordWebVital(input: {
    name: 'CLS' | 'INP' | 'LCP';
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    path: '/' | '/online-zapis' | '/zapis-cherez-telegram';
    navigationType?: string;
  }): Promise<void> {
    await this.prisma.webVitalSample.create({ data: input });
  }

  recordRequest(durationMs: number, status: number, path: string): void {
    this.requestCount += 1;
    this.latencyTotalMs += durationMs;
    if (status >= 500) this.errorCount += 1;
    if (status === 409 && path.includes('/appointments')) this.bookingConflicts += 1;
  }

  async snapshot() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activeCompanies, appointments, outboxPending, notificationsPending, telegramErrors, paymentErrors, webVitalRows] = await Promise.all([
      this.prisma.company.count({ where: { deletedAt: null } }),
      this.prisma.appointment.count(),
      this.prisma.outboxEvent.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      this.prisma.notification.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      this.prisma.telegramUpdate.count({ where: { status: 'FAILED' } }),
      this.prisma.payment.count({ where: { status: 'FAILED' } }),
      this.prisma.webVitalSample.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 10_000,
        select: { name: true, value: true },
      }),
    ]);
    const webVitals = Object.fromEntries(['CLS', 'INP', 'LCP'].map((name) => {
      const values = webVitalRows
        .filter((row) => row.name === name)
        .map((row) => row.value)
        .sort((left, right) => left - right);
      const p75Index = values.length ? Math.min(values.length - 1, Math.ceil(values.length * 0.75) - 1) : -1;
      return [name, { samples: values.length, p75: p75Index >= 0 ? values[p75Index] : null }];
    }));
    return {
      processUptimeSeconds: Math.floor(process.uptime()),
      requests: this.requestCount,
      errors: this.errorCount,
      averageLatencyMs: this.requestCount ? Math.round(this.latencyTotalMs / this.requestCount) : 0,
      activeCompanies,
      appointments,
      bookingConflicts: this.bookingConflicts,
      queueSize: outboxPending + notificationsPending,
      outboxPending,
      notificationsPending,
      telegramErrors,
      paymentErrors,
      webVitals30Days: webVitals,
    };
  }
}
