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
import { PrismaService } from '../database/prisma.service';
import { BotResponseDto } from './dto/bot-response.dto';
import { ConnectBotDto } from './dto/connect-bot.dto';
import { TelegramApiService } from './telegram-api.service';
import { TokenEncryptionService } from './token-encryption.service';

@Injectable()
export class BotsService {
  private readonly publicUrl?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: TokenEncryptionService,
    private readonly telegramApi: TelegramApiService,
  ) {
    this.publicUrl = this.config.get<string>('API_PUBLIC_URL');
  }

  async connect(
    companyId: string,
    input: ConnectBotDto,
  ): Promise<BotResponseDto> {
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
    const existing = await this.prisma.bot.findUnique({ where: { companyId } });
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
            where: { id: existing.id },
            data: {
              telegramBotId: BigInt(botInfo.id),
              username: botInfo.username,
              tokenEncrypted: this.encryption.encrypt(token),
              webhookSecret,
              status,
              errorMessage,
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

    if (status === BotStatus.ERROR) {
      throw new BadGatewayException('Telegram webhook configuration failed');
    }
    return this.toResponse(saved);
  }

  async find(companyId: string): Promise<BotResponseDto | null> {
    const bot = await this.prisma.bot.findUnique({ where: { companyId } });
    return bot ? this.toResponse(bot) : null;
  }

  async activate(companyId: string, botId: string): Promise<BotResponseDto> {
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
      return this.toResponse(
        await this.prisma.bot.update({
          where: { id: bot.id },
          data: { status: BotStatus.ACTIVE, errorMessage: null },
        }),
      );
    } catch (error) {
      await this.prisma.bot.update({
        where: { id: bot.id },
        data: { status: BotStatus.ERROR, errorMessage: this.safeError(error) },
      });
      throw new BadGatewayException('Telegram webhook configuration failed');
    }
  }

  async disable(companyId: string, botId: string): Promise<BotResponseDto> {
    const bot = await this.requireBot(companyId, botId);
    let errorMessage: string | null = null;
    try {
      await this.telegramApi.deleteWebhook(
        this.encryption.decrypt(bot.tokenEncrypted),
      );
    } catch (error) {
      errorMessage = this.safeError(error);
    }
    return this.toResponse(
      await this.prisma.bot.update({
        where: { id: bot.id },
        data: { status: BotStatus.DISABLED, errorMessage },
      }),
    );
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
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
    };
  }
}
