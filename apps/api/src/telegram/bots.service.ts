import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, BotStatus, Prisma } from '@prisma/client';
import { GrammyError } from 'grammy';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../database/prisma.service';
import { BotResponseDto } from './dto/bot-response.dto';
import { ConnectBotDto } from './dto/connect-bot.dto';
import { TelegramApiService } from './telegram-api.service';
import { TokenEncryptionService } from './token-encryption.service';
import { EntitlementsService } from '../billing/entitlements.service';

@Injectable()
export class BotsService {
  private readonly publicUrl?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: TokenEncryptionService,
    private readonly telegramApi: TelegramApiService,
    private readonly entitlements: EntitlementsService,
  ) {
    this.publicUrl = this.config.get<string>('API_PUBLIC_URL');
  }

  async connect(
    companyId: string,
    input: ConnectBotDto,
    actorId?: string,
  ): Promise<BotResponseDto> {
    const existing = await this.prisma.bot.findUnique({ where: { companyId } });
    if (!existing) await this.entitlements.assertCanConnectBot(companyId);
    const token = input.token.trim();
    let botInfo;
    try {
      botInfo = await this.telegramApi.getMe(token);
    } catch (error) {
      if (
        error instanceof GrammyError &&
        [401, 404].includes(error.error_code)
      ) {
        throw new BadRequestException('Telegram bot token is invalid');
      }
      throw new BadGatewayException('Telegram API is unavailable');
    }
    if (!botInfo.username) {
      throw new BadRequestException('Telegram bot must have a username');
    }

    const connectedElsewhere = await this.prisma.bot.findUnique({
      where: { telegramBotId: BigInt(botInfo.id) },
      select: { companyId: true },
    });
    if (connectedElsewhere && connectedElsewhere.companyId !== companyId) {
      throw new ConflictException(
        'This Telegram bot is already connected to another company',
      );
    }
    const webhookSecret = randomBytes(32).toString('base64url');
    let status: BotStatus = BotStatus.DISABLED;
    let errorMessage: string | null = 'API_PUBLIC_URL is not configured';

    if (this.publicUrl) {
      try {
        await this.telegramApi.setWebhook(
          token,
          this.webhookUrl(webhookSecret),
          webhookSecret,
        );
        status = BotStatus.ACTIVE;
        errorMessage = null;
      } catch (error) {
        status = BotStatus.ERROR;
        errorMessage = this.safeError(error);
      }
    }

    let saved: Bot;
    try {
      saved = existing
        ? await this.prisma.bot.update({
            where: { id_companyId: { id: existing.id, companyId } },
            data: {
              telegramBotId: BigInt(botInfo.id),
              username: botInfo.username,
              tokenEncrypted: this.encryption.encrypt(token),
              webhookSecret,
              status,
              errorMessage,
              ...(existing.telegramBotId !== BigInt(botInfo.id) ? { profilePhoto: null, profilePhotoUpdatedAt: null } : {}),
            },
          })
        : await this.prisma.bot.create({
            data: {
              companyId,
              telegramBotId: BigInt(botInfo.id),
              username: botInfo.username,
              tokenEncrypted: this.encryption.encrypt(token),
              webhookSecret,
              status,
              errorMessage,
            },
          });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This Telegram bot is already connected to another company',
        );
      }
      throw error;
    }

    if (existing && existing.telegramBotId !== saved.telegramBotId) {
      try {
        await this.telegramApi.deleteWebhook(
          this.encryption.decrypt(existing.tokenEncrypted),
        );
      } catch {
        // The new bot is already saved; a stale old webhook cannot access it.
      }
    }

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: existing ? 'bot.reconnected' : 'bot.connected',
          entityType: 'Bot',
          entityId: saved.id,
          metadata: { status: saved.status, username: saved.username },
        },
      });
    }

    if (status === BotStatus.ERROR) {
      throw new BadGatewayException('Telegram webhook configuration failed');
    }
    return this.toResponse(saved);
  }

  async find(companyId: string): Promise<BotResponseDto | null> {
    const bot = await this.prisma.bot.findUnique({ where: { companyId } });
    return bot ? this.toResponse(bot) : null;
  }

  async setProfilePhoto(
    companyId: string,
    botId: string,
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    actorId: string,
  ): Promise<BotResponseDto> {
    const bot = await this.requireBot(companyId, botId);
    if (!file || file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Выберите JPG, PNG или WebP до 5 МБ');
    }
    let jpeg: Buffer;
    try {
      const image = sharp(file.buffer, { limitInputPixels: 20_000_000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages ?? 1) !== 1) throw new Error('Unsupported image');
      jpeg = await image.rotate().resize(640, 640, { fit: 'cover' }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
    } catch {
      throw new BadRequestException('Не удалось прочитать фото. Выберите обычное изображение JPG, PNG или WebP до 20 мегапикселей.');
    }
    try {
      await this.telegramApi.setProfilePhoto(this.encryption.decrypt(bot.tokenEncrypted), jpeg);
    } catch {
      throw new BadGatewayException('Telegram не принял аватар. Проверьте подключение бота и повторите загрузку.');
    }
    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.bot.update({
        where: { id_companyId: { id: botId, companyId }, telegramBotId: bot.telegramBotId },
        data: { profilePhoto: Uint8Array.from(jpeg), profilePhotoUpdatedAt: new Date() },
      });
      await tx.auditLog.create({ data: { companyId, actorId, action: 'bot.avatar_updated', entityType: 'Bot', entityId: botId } });
      return updated;
    });
    return this.toResponse(saved);
  }

  async getProfilePhoto(botId: string): Promise<Buffer> {
    const bot = await this.prisma.bot.findFirst({
      where: { id: botId, company: { deletedAt: null } },
      select: { profilePhoto: true },
    });
    if (!bot?.profilePhoto) throw new NotFoundException('Аватар бота не найден');
    return Buffer.from(bot.profilePhoto);
  }

  async activate(companyId: string, botId: string, actorId?: string): Promise<BotResponseDto> {
    if (!this.publicUrl) {
      throw new ServiceUnavailableException('API_PUBLIC_URL is not configured');
    }
    const bot = await this.requireBot(companyId, botId);
    try {
      await this.telegramApi.setWebhook(
        this.encryption.decrypt(bot.tokenEncrypted),
        this.webhookUrl(bot.webhookSecret),
        bot.webhookSecret,
      );
      const updated = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.bot.update({
          where: { id_companyId: { id: bot.id, companyId } },
          data: { status: BotStatus.ACTIVE, errorMessage: null },
        });
        if (actorId) await tx.auditLog.create({ data: {
          companyId, actorId, action: 'bot.activated', entityType: 'Bot', entityId: bot.id,
        } });
        return changed;
      });
      return this.toResponse(updated);
    } catch (error) {
      await this.prisma.bot.update({
        where: { id_companyId: { id: bot.id, companyId } },
        data: { status: BotStatus.ERROR, errorMessage: this.safeError(error) },
      });
      throw new BadGatewayException('Telegram webhook configuration failed');
    }
  }

  async disable(companyId: string, botId: string, actorId?: string): Promise<BotResponseDto> {
    const bot = await this.requireBot(companyId, botId);
    let errorMessage: string | null = null;
    try {
      await this.telegramApi.deleteWebhook(
        this.encryption.decrypt(bot.tokenEncrypted),
      );
    } catch (error) {
      errorMessage = this.safeError(error);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.bot.update({
        where: { id_companyId: { id: bot.id, companyId } },
        data: { status: BotStatus.DISABLED, errorMessage },
      });
      if (actorId) await tx.auditLog.create({ data: {
        companyId, actorId, action: 'bot.disabled', entityType: 'Bot', entityId: bot.id,
        metadata: { webhookRemovalFailed: Boolean(errorMessage) },
      } });
      return changed;
    });
    return this.toResponse(updated);
  }

  private async requireBot(companyId: string, botId: string): Promise<Bot> {
    const bot = await this.prisma.bot.findFirst({
      where: { id: botId, companyId },
    });
    if (!bot) throw new NotFoundException('Telegram bot not found');
    return bot;
  }

  private webhookUrl(secret: string): string {
    return new URL(
      `/api/telegram/webhooks/${secret}`,
      this.publicUrl!,
    ).toString();
  }

  private safeError(error: unknown): string {
    return error instanceof Error
      ? error.message.slice(0, 1000)
      : 'Unknown Telegram API error';
  }

  private toResponse(bot: Bot): BotResponseDto {
    return {
      id: bot.id,
      companyId: bot.companyId,
      telegramBotId: bot.telegramBotId.toString(),
      username: bot.username,
      status: bot.status,
      webhookConfigured: bot.status === BotStatus.ACTIVE,
      errorMessage: bot.errorMessage,
      hasProfilePhoto: Boolean(bot.profilePhoto),
      profilePhotoUpdatedAt: bot.profilePhotoUpdatedAt ?? null,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
    };
  }
}
