import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarCheck2, Check, Clock3, Scissors, TrendingUp, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import telegramIconUrl from '../assets/icontg.png';
import { getDashboard, updateAppointmentStatus } from '../api';
import type { Company } from '../types';
import { formatMoney, formatTime, statusLabel, statusTone } from '../utils';
import { EmptyState, ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';

export function OverviewView({ company }: { company: Company }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dashboard = useQuery({
    queryKey: ['dashboard', company.id],
    queryFn: () => getDashboard(company.id),
  });
  const open = (section: string) => navigate(`/companies/${company.id}/${section}`);
  const setStatus = useMutation({
    mutationFn: ({ appointmentId, status }: { appointmentId: string; status: 'COMPLETED' | 'NO_SHOW' }) => updateAppointmentStatus(company.id, appointmentId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', company.id] }),
  });

  if (dashboard.isLoading) return <LoadingBlock />;
  if (dashboard.error || !dashboard.data) {
    return <ErrorBlock message="Не удалось загрузить обзор. Проверьте подключение к API." />;
  }
  const data = dashboard.data;

  return (
    <>
      <SectionHeader
        eyebrow={new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: company.timezone }).format(new Date())}
        title="Добрый день"
        description="Главное о вашем бизнесе на сегодня — без лишних отчётов."
        action={<button className="primary-button" onClick={() => open('appointments')}><CalendarCheck2 size={17} /> Открыть записи</button>}
      />
      <section className="metrics-grid">
        <Metric icon={CalendarCheck2} label="Записей сегодня" value={String(data.todayAppointments)} />
        <Metric icon={TrendingUp} label="Ожидаемая выручка" value={formatMoney(data.expectedRevenue, data.currency)} />
        <Metric icon={UsersRound} label="Сотрудников" value={String(data.activeEmployees)} />
        <Metric icon={Scissors} label="Активных услуг" value={String(data.activeServices)} />
      </section>
      {data.setupChecklist.some((item) => !item.done) && <section className="setup-checklist panel"><div><p className="eyebrow">Быстрый старт</p><h2>Подготовьте запись</h2></div><div>{data.setupChecklist.map((item) => <button key={item.id} className={item.done ? 'done' : ''} onClick={() => open(item.section)}><span>{item.done ? <Check size={14} /> : null}</span>{item.label}<ArrowRight size={14} /></button>)}</div></section>}
      <section className="overview-grid">
        <article className="panel upcoming-panel">
          <div className="panel-title-row"><div><p className="eyebrow">Живая лента</p><h2>Ближайшие записи</h2></div><button className="text-button" onClick={() => open('appointments')}>Все записи <ArrowRight size={15} /></button></div>
          {!data.upcomingAppointments.length ? (
            <EmptyState title="Пока свободно" description="Новые записи появятся здесь автоматически." />
          ) : (
            <div className="appointment-feed">
              {data.upcomingAppointments.map((appointment) => (
                <div className="appointment-row" key={appointment.id}>
                  <div className="appointment-time"><strong>{formatTime(appointment.startsAt, company.timezone)}</strong></div>
                  <span className="appointment-line" />
                  <div className="appointment-client"><strong>{appointment.customerName}</strong><span>{appointment.serviceName} · {appointment.employeeName}</span></div>
                  <span className={`status-badge ${statusTone[appointment.status]}`}>{statusLabel[appointment.status]}</span>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className={`panel bot-card ${data.bot?.status === 'ACTIVE' ? 'bot-card-active' : ''}`}>
          <span className="bot-card-icon"><img src={telegramIconUrl} alt="" /></span>
          {data.bot?.status === 'ACTIVE' ? (
            <><p className="eyebrow">Telegram подключён</p><h2>@{data.bot.username}</h2><button className="secondary-button light" onClick={() => open('bot')}>Настройки бота <ArrowRight size={16} /></button></>
          ) : (
            <><p className="eyebrow">Следующий шаг</p><h2>Запись через Telegram</h2><p>Подключите бота — клиенты смогут записываться круглосуточно.</p><ul><li><Clock3 size={16} />Свободные слоты в реальном времени</li><li><CalendarCheck2 size={16} />Запись сразу в календаре</li></ul><button className="secondary-button light" onClick={() => open('bot')}>Подключить бота <ArrowRight size={16} /></button></>
          )}
        </article>
      </section>
      {data.upcomingAppointments.length > 0 && <section className="today-strip panel"><div><div><p className="eyebrow">Сегодня</p><h2>Оперативные действия</h2></div><button className="text-button" onClick={() => open('calendar')}>Календарь <ArrowRight size={15} /></button></div><div>{data.upcomingAppointments.slice(0, 3).map((appointment) => <article key={appointment.id}><time>{formatTime(appointment.startsAt, company.timezone)}</time><span><strong>{appointment.customerName}</strong><small>{appointment.serviceName} · {appointment.employeeName}</small></span>{appointment.status === 'CONFIRMED' && <div className="today-actions"><button className="compact-action" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ appointmentId: appointment.id, status: 'COMPLETED' })}>Завершить</button><button className="compact-action muted" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ appointmentId: appointment.id, status: 'NO_SHOW' })}>Не пришёл</button></div>}</article>)}</div></section>}
    </>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof CalendarCheck2; label: string; value: string }) {
  return <article className="metric-card"><span className="metric-icon"><Icon size={19} /></span><div><p>{label}</p><strong>{value}</strong></div></article>;
}
