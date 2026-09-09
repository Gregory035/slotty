import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MetricsService {
  private requestCount = 0;
  private errorCount = 0;
  private latencyTotalMs = 0;
  private bookingConflicts = 0;

  constructor(private readonly prisma: PrismaService) {}

  recordRequest(durationMs: number, status: number, path: string): void {
    this.requestCount += 1;
    this.latencyTotalMs += durationMs;
    if (status >= 500) this.errorCount += 1;
    if (status === 409 && path.includes('/appointments')) this.bookingConflicts += 1;
  }

  async snapshot() {
    const [activeCompanies, appointments, outboxPending, notificationsPending, telegramErrors, paymentErrors] = await Promise.all([
      this.prisma.company.count({ where: { deletedAt: null } }),
      this.prisma.appointment.count(),
      this.prisma.outboxEvent.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      this.prisma.notification.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      this.prisma.telegramUpdate.count({ where: { status: 'FAILED' } }),
      this.prisma.payment.count({ where: { status: 'FAILED' } }),
    ]);
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
    };
  }
}
