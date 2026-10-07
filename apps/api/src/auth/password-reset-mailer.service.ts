import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordResetMailerService {
  private readonly logger = new Logger(PasswordResetMailerService.name);

  constructor(private readonly config: ConfigService) {}

  assertConfigured(): void {
    if (this.config.get<string>('NODE_ENV') === 'production' &&
      (!this.config.get<string>('RESEND_API_KEY') || !this.config.get<string>('PASSWORD_RESET_FROM_EMAIL'))) {
      throw new ServiceUnavailableException('Восстановление пароля временно недоступно');
    }
  }

  async send(input: { email: string; firstName: string; resetUrl: string; expiresInMinutes: number }): Promise<void> {
    const key = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('PASSWORD_RESET_FROM_EMAIL');
    if (!key || !from) {
      this.logger.warn(`Password reset URL for ${input.email}: ${input.resetUrl}`);
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: 'Восстановление пароля в Slotty',
        text: [`Здравствуйте, ${input.firstName}!`, '', 'Чтобы задать новый пароль для Slotty, откройте ссылку:', input.resetUrl, '', `Ссылка действует ${input.expiresInMinutes} мин. и работает один раз. Если это были не вы, проигнорируйте письмо.`].join('\n'),
      }),
    });
    if (!response.ok) {
      this.logger.error(`Resend rejected password reset email: ${response.status}`);
      throw new ServiceUnavailableException('Не удалось отправить письмо для восстановления');
    }
  }
}
