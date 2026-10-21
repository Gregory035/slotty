import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyRole } from '@prisma/client';
import webpush, { type PushSubscription } from 'web-push';
import { PrismaService } from '../database/prisma.service';
import { SavePushSubscriptionDto } from './dto/push-subscription.dto';

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

  async sendToCompany(companyId: string, payload: BusinessPushPayload): Promise<void> {
    if (!this.enabled) return;
    const subscriptions = await this.prisma.webPushSubscription.findMany({
      where: {
        user: {
          memberships: {
            some: { companyId, role: { in: [CompanyRole.OWNER, CompanyRole.ADMIN] } },
          },
        },
      },
    });
    await Promise.all(subscriptions.map(async (item) => {
      const subscription: PushSubscription = {
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth },
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 300 });
      } catch (error) {
        const statusCode = this.statusCode(error);
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.webPushSubscription.delete({ where: { id: item.id } });
          return;
        }
        this.logger.warn(`Push delivery failed (${statusCode ?? 'unknown'}): ${this.message(error)}`);
      }
    }));
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
