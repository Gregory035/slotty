import { Injectable } from '@nestjs/common';
import { Api, InlineKeyboard } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';

@Injectable()
export class TelegramApiService {
  private createApi(token: string): Api {
    const apiRoot = process.env.TELEGRAM_API_ROOT?.trim();
    const useEnvironmentProxy = process.env.TELEGRAM_USE_ENV_PROXY === 'true';
    return new Api(token, {
      ...(apiRoot ? { apiRoot } : {}),
      ...(useEnvironmentProxy ? { fetch: globalThis.fetch } : {}),
    });
  }

  getMe(token: string): Promise<UserFromGetMe> {
    return this.createApi(token).getMe();
  }

  async setWebhook(
    token: string,
    url: string,
    secretToken: string,
  ): Promise<void> {
    await this.createApi(token).setWebhook(url, {
      secret_token: secretToken,
      allowed_updates: ['message', 'callback_query'],
    });
  }

  async deleteWebhook(token: string): Promise<void> {
    await this.createApi(token).deleteWebhook({ drop_pending_updates: true });
  }

  async sendMessage(
    token: string,
    chatId: number | string,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<void> {
    await this.createApi(token).sendMessage(chatId, text, {
      ...(keyboard ? { reply_markup: keyboard } : {}),
    });
  }

  async answerCallbackQuery(token: string, callbackQueryId: string): Promise<void> {
    await this.createApi(token).answerCallbackQuery(callbackQueryId);
  }

  async clearInlineKeyboard(
    token: string,
    chatId: number | string,
    messageId: number,
  ): Promise<void> {
    await this.createApi(token).editMessageReplyMarkup(chatId, messageId, {
      reply_markup: { inline_keyboard: [] },
    });
  }
}
