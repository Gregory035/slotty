import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CircleDollarSign, UserRoundCheck, UsersRound } from 'lucide-react';
import { getDashboard } from '../api';
import type { Company } from '../types';
import { formatMoney } from '../utils';
import { ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';

const day = 86_400_000;

function isoDate(offset = 0) {
  const value = new Date(Date.now() + offset * day);
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function AnalyticsView({ company }: { company: Company }) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const dates = useMemo(() => ({ from: isoDate(-(range - 1)), to: isoDate() }), [range]);
  const dashboard = useQuery({
    queryKey: ['dashboard', company.id, dates.from, dates.to],
    queryFn: () => getDashboard(company.id, dates.from, dates.to),
  });
  if (dashboard.isLoading) return <LoadingBlock />;
  if (dashboard.error || !dashboard.data) return <ErrorBlock message="Не удалось загрузить аналитику." />;
  const data = dashboard.data;
  const { analytics } = data;
  const peak = Math.max(...analytics.daily.map((item) => item.revenue), 1);
  const totalSources = analytics.sources.telegram + analytics.sources.dashboard || 1;

  return <>
    <SectionHeader eyebrow="Показатели" title="Аналитика" description="Выручка, загрузка и качество записей без ручных таблиц." action={<div className="filter-pills analytics-range">{([7, 30, 90] as const).map((item) => <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item} дн.</button>)}</div>} />
    <section className="analytics-kpi-grid">
      <Insight icon={CircleDollarSign} label="Выручка" value={formatMoney(analytics.summary.actualRevenue, data.currency)} detail={`Средний чек ${formatMoney(analytics.summary.averageCheck, data.currency)}`} />
      <Insight icon={BarChart3} label="Загрузка" value={`${data.occupancy.percent}%`} detail={`${analytics.summary.completed} завершено из ${analytics.summary.appointments}`} />
      <Insight icon={UsersRound} label="Клиенты" value={String(analytics.summary.newCustomers + analytics.summary.returningCustomers)} detail={`Новых ${analytics.summary.newCustomers} · повторных ${analytics.summary.returningCustomers}`} />
      <Insight icon={UserRoundCheck} label="Качество записи" value={`${100 - analytics.summary.cancellationRate - analytics.summary.noShowRate}%`} detail={`Отмены ${analytics.summary.cancellationRate}% · не пришли ${analytics.summary.noShowRate}%`} />
    </section>
    <section className="analytics-layout">
      <article className="panel analytics-chart-panel">
        <div className="panel-title-row"><div><p className="eyebrow">Динамика</p><h2>Выручка по дням</h2></div><strong>{formatMoney(analytics.summary.actualRevenue, data.currency)}</strong></div>
        <div className="revenue-chart" aria-label="Выручка по дням">
          {analytics.daily.map((item) => <div key={item.date} className="revenue-bar-wrap" title={`${item.date}: ${formatMoney(item.revenue, data.currency)}`}><div className="revenue-bar" style={{ height: `${Math.max(5, (item.revenue / peak) * 100)}%` }} /><span>{item.date.slice(8)}</span></div>)}
        </div>
      </article>
      <article className="panel analytics-source-panel">
        <p className="eyebrow">Канал записи</p><h2>Откуда приходят клиенты</h2>
        <div className="source-row"><span>Telegram</span><strong>{analytics.sources.telegram}</strong><i><b style={{ width: `${(analytics.sources.telegram / totalSources) * 100}%` }} /></i></div>
        <div className="source-row"><span>Панель</span><strong>{analytics.sources.dashboard}</strong><i><b style={{ width: `${(analytics.sources.dashboard / totalSources) * 100}%` }} /></i></div>
        {data.waitlistCount > 0 && <p className="analytics-note">В листе ожидания: {data.waitlistCount}</p>}
      </article>
    </section>
    <section className="panel funnel-panel"><div><p className="eyebrow">Telegram</p><h2>Воронка записи</h2><span>Конверсия в запись: <strong>{analytics.funnel.conversion}%</strong></span></div><div className="funnel-steps">{[
      ['Начал', analytics.funnel.started], ['Выбрал услугу', analytics.funnel.serviceSelected], ['Выбрал дату', analytics.funnel.dateSelected], ['Выбрал время', analytics.funnel.timeSelected], ['Записался', analytics.funnel.booked],
    ].map(([label, value]) => <article key={String(label)}><strong>{value}</strong><span>{label}</span></article>)}</div></section>
    <section className="analytics-tables">
      <Leaderboard title="Услуги" rows={analytics.services} currency={data.currency} />
      <Leaderboard title="Сотрудники" rows={analytics.employees} currency={data.currency} />
    </section>
  </>;
}

function Insight({ icon: Icon, label, value, detail }: { icon: typeof BarChart3; label: string; value: string; detail: string }) {
  return <article className="analytics-kpi"><span><Icon size={18} /></span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}

function Leaderboard({ title, rows, currency }: { title: string; rows: Array<{ id: string; name: string; appointments: number; completed: number; revenue: number }>; currency: string }) {
  return <article className="panel leaderboard"><div className="panel-title-row"><h2>{title}</h2><span>Записи · выручка</span></div>{rows.length ? <div>{rows.slice(0, 5).map((row, index) => <div className="leaderboard-row" key={row.id}><b>{index + 1}</b><strong>{row.name}</strong><span>{row.appointments}</span><em>{formatMoney(row.revenue, currency)}</em></div>)}</div> : <p className="muted-text">За выбранный период данных пока нет.</p>}</article>;
}
