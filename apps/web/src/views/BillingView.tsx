import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ExternalLink } from 'lucide-react';
import { createCheckout, getEntitlements, getPayments, syncPayment } from '../api';
import { useToast } from '../components/ToastProvider';
import { ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';
import type { Company } from '../types';
import { errorMessage, formatMoney } from '../utils';

export function BillingView({ company }: { company: Company }) {
  const { notify } = useToast();
  const billing = useQuery({ queryKey: ['billing', company.id], queryFn: () => getEntitlements(company.id) });
  const payments = useQuery({ queryKey: ['payments', company.id], queryFn: () => getPayments(company.id) });
  const checkout = useMutation({
    mutationFn: (plan: 'STARTER' | 'PRO') => createCheckout(company.id, plan),
    onSuccess: ({ confirmationUrl }) => { window.location.assign(confirmationUrl); },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  const sync = useMutation({
    mutationFn: (paymentId: string) => syncPayment(company.id, paymentId),
    onSuccess: async () => {
      notify('Статус платежа обновлён');
      await Promise.all([payments.refetch(), billing.refetch()]);
    },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  if (billing.isLoading) return <LoadingBlock />;
  if (billing.error || !billing.data) return <ErrorBlock message="Не удалось загрузить тариф" />;
  const periodEnd = billing.data.currentPeriodEndsAt ?? billing.data.trialEndsAt ?? billing.data.graceEndsAt;
  return (
    <>
      <SectionHeader
        eyebrow="Подписка"
        title="Тариф и платежи"
        description={`${planLabel[billing.data.plan]} · ${subscriptionStatusLabel[billing.data.status]}${periodEnd ? ` до ${formatDate(periodEnd)}` : ''}.`}
      />
      <div className="plan-grid">
        <Plan name="Starter" price="990 ₽" features={['До 10 сотрудников', 'До 1000 записей в месяц', 'Стандартные уведомления']} active={billing.data.plan === 'STARTER'} pending={checkout.isPending} action={() => checkout.mutate('STARTER')} />
        <Plan name="Pro" price="2490 ₽" features={['До 100 сотрудников', 'Расширенная аналитика', 'Кастомные уведомления']} active={billing.data.plan === 'PRO'} pending={checkout.isPending} action={() => checkout.mutate('PRO')} />
      </div>
      <article className="panel usage-panel"><h2>Использование лимитов</h2>{Object.entries(billing.data.usage).map(([key, value]) => { const limit = billing.data.limits[key as keyof typeof billing.data.usage] as number; return <div className="usage-row" key={key}><span>{usageLabel[key] ?? key}</span><strong>{value} / {limit}</strong><div><i style={{ width: `${Math.min(100, value / limit * 100)}%` }} /></div></div>; })}</article>
      <article className="panel payments-panel"><h2>История платежей</h2>{payments.data?.items.length ? payments.data.items.map((payment) => <div className="data-row" key={payment.id}><div><strong>{planLabel[payment.planSnapshot]}</strong><span>{formatDate(payment.createdAt)}</span></div><strong>{formatMoney(payment.amount, payment.currency)}</strong><span className={`status-badge ${payment.status === 'SUCCEEDED' ? 'badge-green' : 'badge-muted'}`}>{paymentStatusLabel[payment.status]}</span>{payment.status === 'PENDING' && <button className="secondary-button compact" disabled={sync.isPending} onClick={() => sync.mutate(payment.id)}>Проверить оплату</button>}</div>) : <p className="muted-text">Платежей пока нет.</p>}</article>
    </>
  );
}

const usageLabel: Record<string, string> = { employees: 'Сотрудники', services: 'Услуги', monthlyAppointments: 'Записи за месяц', bots: 'Telegram-боты' };
const planLabel = { TRIAL: 'Пробный период', STARTER: 'Starter', PRO: 'Pro' } as const;
const subscriptionStatusLabel: Record<Company['subscriptionStatus'] & string, string> = {
  TRIALING: 'пробный период', ACTIVE: 'активен', PAST_DUE: 'льготный период — требуется оплата', CANCELLED: 'отменён', EXPIRED: 'истёк',
};
const paymentStatusLabel = { PENDING: 'Ожидает оплаты', SUCCEEDED: 'Оплачен', FAILED: 'Ошибка', REFUNDED: 'Возвращён' } as const;
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU').format(new Date(value));

function Plan({ name, price, features, active, pending, action }: { name: string; price: string; features: string[]; active: boolean; pending: boolean; action: () => void }) {
  return <article className={`panel plan-card ${active ? 'active' : ''}`}><p className="eyebrow">Тариф</p><h2>{name}</h2><strong className="plan-price">{price}<small>/месяц</small></strong><ul>{features.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul><button className={active ? 'secondary-button' : 'primary-button'} disabled={pending} onClick={action}>{active ? <>Продлить <ExternalLink size={15} /></> : <>Выбрать <ExternalLink size={15} /></>}</button></article>;
}
