import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, ExternalLink, KeyRound, Link2, Power, ShieldCheck } from 'lucide-react';
import { activateBot, connectBot, disableBot, getBot } from '../api';
import type { Company } from '../types';
import { errorMessage } from '../utils';
import { ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';

export function BotView({ company }: { company: Company }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const bot = useQuery({ queryKey: ['bot', company.id], queryFn: () => getBot(company.id) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['bot', company.id] });
  const connectMutation = useMutation({
    mutationFn: (token: string) => connectBot(company.id, token),
    onSuccess: async () => { setError(null); await refresh(); },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const activateMutation = useMutation({ mutationFn: (id: string) => activateBot(company.id, id), onSuccess: refresh, onError: (caught) => setError(errorMessage(caught)) });
  const disableMutation = useMutation({ mutationFn: (id: string) => disableBot(company.id, id), onSuccess: refresh, onError: (caught) => setError(errorMessage(caught)) });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    connectMutation.mutate(String(new FormData(event.currentTarget).get('token')));
  }

  if (bot.isLoading) return <LoadingBlock />;
  if (bot.error) return <ErrorBlock message="Не удалось загрузить настройки бота" />;

  return (
    <>
      <SectionHeader eyebrow="Онлайн-запись" title="Telegram-бот" description="Ваш цифровой администратор: показывает услуги и записывает клиентов 24/7." />
      <div className="bot-settings-grid">
        <section className="panel bot-setup-panel">
          {bot.data ? (
            <>
              <div className="connected-bot-head"><span className="telegram-logo"><Bot size={28} /></span><div><p className="eyebrow">Подключённый бот</p><h2>@{bot.data.username}</h2></div><span className={`bot-status-pill bot-${bot.data.status.toLowerCase()}`}><i />{botStatus(bot.data.status)}</span></div>
              <div className="bot-details"><div><span>ID бота</span><strong>{bot.data.telegramBotId}</strong></div><div><span>Webhook</span><strong>{bot.data.webhookConfigured ? 'Настроен' : 'Неактивен'}</strong></div><div><span>Подключён</span><strong>{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(bot.data.createdAt))}</strong></div></div>
              {bot.data.errorMessage && <div className="bot-warning"><strong>Нужен публичный адрес API</strong><p>{bot.data.errorMessage === 'API_PUBLIC_URL is not configured' ? 'Локально бот сохранён, но для реальных сообщений понадобится размещение сервера с HTTPS.' : bot.data.errorMessage}</p></div>}
              <div className="bot-action-row">
                {bot.data.status === 'ACTIVE' ? <button className="secondary-button danger-outline" onClick={() => disableMutation.mutate(bot.data!.id)} disabled={disableMutation.isPending}><Power size={16} /> Отключить</button> : <button className="primary-button" onClick={() => activateMutation.mutate(bot.data!.id)} disabled={activateMutation.isPending}><Power size={16} /> Активировать</button>}
                <a className="secondary-button" href={`https://t.me/${bot.data.username}`} target="_blank" rel="noreferrer">Открыть бота <ExternalLink size={15} /></a>
              </div>
              <details className="replace-token"><summary>Заменить токен</summary><TokenForm busy={connectMutation.isPending} submit={submit} /></details>
            </>
          ) : (
            <>
              <span className="bot-hero-icon"><Bot size={34} /></span>
              <p className="eyebrow">Подключение за минуту</p>
              <h2>Добавьте своего бота</h2>
              <p className="bot-intro">Получите токен у официального <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> и вставьте его ниже. Токен сразу зашифруется.</p>
              <TokenForm busy={connectMutation.isPending} submit={submit} />
            </>
          )}
          {error && <p className="form-error bot-form-error">{error}</p>}
        </section>

        <aside className="bot-guide">
          <p className="eyebrow">Как это работает</p>
          <h2>От токена до первой записи</h2>
          <ol>
            <li><span>1</span><div><strong>Создайте бота</strong><p>Откройте @BotFather, отправьте /newbot и придумайте имя.</p></div></li>
            <li><span>2</span><div><strong>Вставьте токен</strong><p>Он хранится в зашифрованном виде и не показывается повторно.</p></div></li>
            <li><span>3</span><div><strong>Опубликуйте расписание</strong><p>Бот сам предложит только свободные часы.</p></div></li>
          </ol>
          <div className="security-note"><ShieldCheck size={20} /><div><strong>Безопасное подключение</strong><p>Webhook защищён секретом, а повторная запись на занятый слот блокируется.</p></div></div>
        </aside>
      </div>

      <section className="bot-benefits">
        <div><CheckCircle2 size={20} /><span><strong>Без переписки</strong>Клиент сам проходит все шаги</span></div>
        <div><Link2 size={20} /><span><strong>Всегда синхронно</strong>Записи сразу появляются в панели</span></div>
        <div><KeyRound size={20} /><span><strong>Токен защищён</strong>AES-256-GCM шифрование</span></div>
      </section>
    </>
  );
}

function TokenForm({ busy, submit }: { busy: boolean; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="token-form" onSubmit={submit}><label>Токен от BotFather<div><KeyRound size={17} /><input name="token" type="password" required minLength={20} maxLength={256} placeholder="123456789:AA..." autoComplete="off" /></div></label><button className="primary-button" disabled={busy}>{busy ? 'Проверяем…' : 'Подключить бота'}</button></form>;
}

function botStatus(status: 'ACTIVE' | 'DISABLED' | 'ERROR') {
  return { ACTIVE: 'Активен', DISABLED: 'Отключён', ERROR: 'Ошибка' }[status];
}
