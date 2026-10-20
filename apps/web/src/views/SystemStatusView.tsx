import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CircleDollarSign, DatabaseBackup, Mail, RefreshCw, ServerCog, ShieldCheck, Webhook } from 'lucide-react';
import { getSystemStatus } from '../api';
import { ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';
import type { Company } from '../types';

export function SystemStatusView({ company }: { company: Company }) {
  const status = useQuery({
    queryKey: ['system-status', company.id],
    queryFn: () => getSystemStatus(company.id),
    refetchInterval: 30_000,
  });
  if (status.isLoading) return <LoadingBlock label="Проверяем систему" />;
  if (status.error || !status.data) return <ErrorBlock message="Не удалось получить состояние системы." />;
  const data = status.data;
  const queueProblems = (data.queues.notifications.FAILED ?? 0) + (data.queues.outbox.DEAD ?? 0) + (data.queues.telegram.FAILED ?? 0);
  const cards = [
    { icon: Webhook, title: 'Telegram', ok: data.bot?.status === 'ACTIVE' && data.bot.webhookConfigured, detail: data.bot ? `@${data.bot.username} · ${data.bot.webhookConfigured ? 'webhook работает' : 'webhook не настроен'}` : 'Бот не подключён' },
    { icon: ServerCog, title: 'Очереди', ok: queueProblems === 0, detail: queueProblems ? `${queueProblems} ошибок требуют внимания` : 'Ошибок доставки нет' },
    { icon: CircleDollarSign, title: 'Платежи', ok: data.integrations.paymentProvider, detail: data.integrations.paymentProvider ? `Провайдер подключён · ${data.billing.subscription?.status ?? 'нет подписки'}` : 'YooKassa не настроена' },
    { icon: Mail, title: 'Восстановление пароля', ok: data.integrations.passwordRecovery, detail: data.integrations.passwordRecovery ? 'Отправка писем настроена' : 'Нужны RESEND_API_KEY и адрес отправителя' },
    { icon: ShieldCheck, title: 'Ошибки приложения', ok: data.integrations.errorTracking, detail: data.integrations.errorTracking ? 'Sentry подключён' : 'Sentry DSN не задан' },
    { icon: DatabaseBackup, title: 'Резервные копии', ok: data.backup?.state === 'success', detail: backupLabel(data.backup, data.integrations.offsiteBackup) },
  ];
  return <>
    <SectionHeader eyebrow="Надёжность" title="Состояние системы" description="Интеграции, фоновые очереди, платежи и резервные копии в одном месте." action={<button className="secondary-button" onClick={() => void status.refetch()} disabled={status.isFetching}><RefreshCw size={16} /> Обновить</button>} />
    <section className="system-status-grid">
      {cards.map(({ icon: Icon, title, ok, detail }) => <article className="panel system-status-card" key={title}><span className={ok ? 'system-ok' : 'system-warning'}>{ok ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}</span><Icon size={22} /><div><h2>{title}</h2><p>{detail}</p></div></article>)}
    </section>
    <section className="panel system-queue-panel"><div><p className="eyebrow">Фоновые процессы</p><h2>Очереди</h2></div><div className="system-queue-grid"><Queue label="Уведомления" values={data.queues.notifications} /><Queue label="События" values={data.queues.outbox} /><Queue label="Telegram" values={data.queues.telegram} /><Queue label="Платежи за 30 дней" values={data.billing.paymentsLast30Days} /></div></section>
    <p className="system-checked">Последняя проверка: {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(data.checkedAt))}</p>
  </>;
}

function Queue({ label, values }: { label: string; values: Record<string, number> }) {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  const failures = (values.FAILED ?? 0) + (values.DEAD ?? 0);
  return <article><span>{label}</span><strong>{total}</strong><small className={failures ? 'danger-text' : ''}>{failures ? `Ошибок: ${failures}` : 'Без ошибок'}</small></article>;
}

function backupLabel(backup: { state: 'running' | 'success' | 'failed'; finishedAt?: string; remote?: boolean } | null, offsite: boolean) {
  if (!backup) return 'Последний запуск пока не зафиксирован';
  if (backup.state === 'running') return 'Копирование выполняется';
  if (backup.state === 'failed') return 'Последняя копия завершилась с ошибкой';
  const date = backup.finishedAt ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(backup.finishedAt)) : 'готова';
  return `${date} · ${backup.remote || offsite ? 'есть внешняя копия' : 'только на сервере'}`;
}
