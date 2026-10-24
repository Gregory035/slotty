import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CompanyInvitationMailerService {
  private readonly logger = new Logger(CompanyInvitationMailerService.name);

  constructor(private readonly config: ConfigService) {}

  assertConfigured(): void {
    if (this.config.get<string>('NODE_ENV') === 'production' &&
      (!this.config.get<string>('RESEND_API_KEY') || !this.config.get<string>('PASSWORD_RESET_FROM_EMAIL'))) {
      throw new ServiceUnavailableException('Отправка приглашений временно недоступна');
    }
  }

  async send(input: { email: string; companyName: string; invitationUrl: string; expiresInHours: number }): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('PASSWORD_RESET_FROM_EMAIL');
    if (!apiKey || !from) {
      this.logger.log(`Invitation URL for ${input.email}: ${input.invitationUrl}`);
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: `Приглашение в ${input.companyName} — Slotty`,
        html: `<p>Вас пригласили в рабочее пространство «${this.escape(input.companyName)}».</p><p><a href="${this.escape(input.invitationUrl)}">Принять приглашение</a></p><p>Ссылка действует ${input.expiresInHours} ч.</p>`,
      }),
    });
    if (!response.ok) throw new BadGatewayException('Не удалось отправить приглашение');
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  }
}
