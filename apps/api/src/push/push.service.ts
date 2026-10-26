import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyRole } from '@prisma/client';
import webpush, { type PushSubscription } from 'web-push';
import { PrismaService } from '../database/prisma.service';
import { SavePushSubscriptionDto } from './dto/push-subscription.dto';
import { PushPreferenceDto, UpdatePushPreferenceDto } from './dto/push-preference.dto';

export type BusinessPushEvent = 'appointment.created' | 'appointment.rescheduled' | 'appointment.cancelled';

export interface BusinessPushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey: string | null;
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const publicKey = config.get<string>('WEB_PUSH_PUBLIC_KEY');
    const privateKey = config.get<string>('WEB_PUSH_PRIVATE_KEY');
    const subject = config.get<string>('WEB_PUSH_SUBJECT');
    this.enabled = Boolean(publicKey && privateKey && subject);
    this.publicKey = this.enabled ? publicKey! : null;
    if (this.enabled) webpush.setVapidDetails(subject!, publicKey!, privateKey!);
  }

  config(): { enabled: boolean; publicKey: string | null } {
    return { enabled: this.enabled, publicKey: this.publicKey };
  }

  async save(userId: string, input: SavePushSubscriptionDto, userAgent?: string): Promise<void> {
    await this.prisma.webPushSubscription.upsert({
      where: { endpoint: input.endpoint },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: userAgent?.slice(0, 500) || null,
      },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: userAgent?.slice(0, 500) || null,
      },
    });
  }

  async remove(userId: string, endpoint: string): Promise<void> {
    await this.prisma.webPushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async preferences(userId: string): Promise<PushPreferenceDto> {
    const saved = await this.prisma.pushPreference.findUnique({ where: { userId } });
    return {
      appointmentCreated: saved?.appointmentCreated ?? true,
      appointmentRescheduled: saved?.appointmentRescheduled ?? true,
      appointmentCancelled: saved?.appointmentCancelled ?? true,
    };
  }

  async updatePreferences(userId: string, input: UpdatePushPreferenceDto): Promise<PushPreferenceDto> {
    const saved = await this.prisma.pushPreference.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input },
    });
    return {
      appointmentCreated: saved.appointmentCreated,
      appointmentRescheduled: saved.appointmentRescheduled,
      appointmentCancelled: saved.appointmentCancelled,
    };
  }

  async sendTest(userId: string, endpoint: string): Promise<void> {
    if (!this.enabled) throw new ServiceUnavailableException('Push-уведомления временно недоступны на сервере');
    const subscriptions = await this.prisma.webPushSubscription.findMany({ where: { userId, endpoint } });
    if (!subscriptions.length) throw new BadRequestException('Подключение этого устройства не найдено. Выключите и снова включите уведомления.');
    const delivered = await this.deliver(subscriptions, {
      title: 'Уведомления работают',
      body: 'Slotty сможет сообщать о новых, перенесённых и отменённых записях.',
      url: '/app',
      tag: `push-test-${Date.now()}`,
    });
    if (!delivered) throw new ServiceUnavailableException('Push-сервис отклонил уведомление для этого устройства. Выключите и снова включите уведомления, затем повторите тест.');
  }

  async sendToCompany(
    companyId: string,
    payload: BusinessPushPayload,
    options: { event: BusinessPushEvent; employeeId: string },
  ): Promise<number> {
    if (!this.enabled) return 0;
    const subscriptions = await this.prisma.webPushSubscription.findMany({
      where: {
        user: {
          memberships: {
            some: {
              companyId,
              OR: [
                { role: { in: [CompanyRole.OWNER, CompanyRole.ADMIN] } },
                { role: CompanyRole.EMPLOYEE, employeeId: options.employeeId },
              ],
            },
          },
        },
      },
      include: { user: { select: { pushPreference: true } } },
    });
    const preferenceKey = this.preferenceKey(options.event);
    return this.deliver(subscriptions.filter((item) => item.user.pushPreference?.[preferenceKey] !== false), payload);
  }

  private async deliver(
    subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
    payload: BusinessPushPayload,
  ): Promise<number> {
    let delivered = 0;
    await Promise.all(subscriptions.map(async (item) => {
      const subscription: PushSubscription = {
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth },
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), {
          TTL: 300,
          urgency: 'high',
          timeout: 10_000,
        });
        delivered += 1;
      } catch (error) {
        const statusCode = this.statusCode(error);
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.webPushSubscription.delete({ where: { id: item.id } });
          return;
        }
        this.logger.warn(`Push delivery failed (${statusCode ?? 'unknown'}): ${this.message(error)}`);
      }
    }));
    return delivered;
  }

  private preferenceKey(event: BusinessPushEvent): keyof PushPreferenceDto {
    if (event === 'appointment.created') return 'appointmentCreated';
    if (event === 'appointment.rescheduled') return 'appointmentRescheduled';
    return 'appointmentCancelled';
  }

  private statusCode(error: unknown): number | null {
    if (typeof error === 'object' && error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }
    return null;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message.slice(0, 500) : 'Unknown error';
  }
}
