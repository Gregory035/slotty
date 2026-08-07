import { Injectable } from '@nestjs/common';
import { Api, InlineKeyboard } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';

@Injectable()
export class TelegramApiService {
  getMe(token: string): Promise<UserFromGetMe> {
    return new Api(token).getMe();
  }

  async setWebhook(
    token: string,
    url: string,
    secretToken: string,
  ): Promise<void> {
    await new Api(token).setWebhook(url, {
      secret_token: secretToken,
      allowed_updates: ['message', 'callback_query'],
    });
  }

  async deleteWebhook(token: string): Promise<void> {
    await new Api(token).deleteWebhook({ drop_pending_updates: true });
  }

  async sendMessage(
    token: string,
    chatId: number | string,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<void> {
    await new Api(token).sendMessage(chatId, text, {
      ...(keyboard ? { reply_markup: keyboard } : {}),
    });
  }

  async answerCallbackQuery(token: string, callbackQueryId: string): Promise<void> {
    await new Api(token).answerCallbackQuery(callbackQueryId);
  }
}
