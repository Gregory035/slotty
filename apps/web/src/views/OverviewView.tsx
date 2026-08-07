import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  CalendarCheck2,
  Clock3,
  Scissors,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { getAppointments, getBot, getEmployees, getServices } from '../api';
import { useAppStore } from '../store';
import type { Company } from '../types';
import { formatMoney, formatTime, statusLabel, statusTone } from '../utils';
import { EmptyState, ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';

export function OverviewView({ company }: { company: Company }) {
  const setSection = useAppStore((state) => state.setSection);
  const services = useQuery({ queryKey: ['services', company.id], queryFn: () => getServices(company.id) });
  const employees = useQuery({ queryKey: ['employees', company.id], queryFn: () => getEmployees(company.id) });
  const appointments = useQuery({
    queryKey: ['appointments', company.id],
    queryFn: () => getAppointments(company.id),
  });
  const bot = useQuery({ queryKey: ['bot', company.id], queryFn: () => getBot(company.id) });

  if (services.isLoading || employees.isLoading || appointments.isLoading) return <LoadingBlock />;
  if (services.error || employees.error || appointments.error) return <ErrorBlock message="Не удалось загрузить обзор. Проверьте подключение к API." />;

  const activeServices = services.data?.filter((item) => item.isActive) ?? [];
  const activeEmployees = employees.data?.filter((item) => item.isActive) ?? [];
  const todayKey = localDateKey(new Date().toISOString(), company.timezone);
  const todayAppointments = appointments.data?.filter(
    (appointment) => localDateKey(appointment.startsAt, company.timezone) === todayKey,
  ) ?? [];
  const activeAppointments = todayAppointments.filter((item) => !item.status.startsWith('CANCELLED'));
  const revenue = activeAppointments.reduce((sum, item) => sum + Number(item.price), 0);

  return (
    <>
      <SectionHeader
        eyebrow={new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: company.timezone }).format(new Date())}
        title={`Добрый день`}
        description="Главное о вашем бизнесе на сегодня — без лишних отчётов."
        action={<button className="primary-button" onClick={() => setSection('appointments')}><CalendarCheck2 size={17} /> Открыть записи</button>}
      />

      <section className="metrics-grid">
        <Metric icon={CalendarCheck2} label="Записей сегодня" value={String(activeAppointments.length)} note={`${todayAppointments.length} всего`} />
        <Metric icon={TrendingUp} label="Выручка сегодня" value={formatMoney(revenue, company.currency)} note="По активным записям" />
        <Metric icon={UsersRound} label="Сотрудников" value={String(activeEmployees.length)} note="Принимают клиентов" />
        <Metric icon={Scissors} label="Активных услуг" value={String(activeServices.length)} note="Доступны в Telegram" />
      </section>

      <section className="overview-grid">
        <article className="panel upcoming-panel">
          <div className="panel-title-row"><div><p className="eyebrow">Живая лента</p><h2>Записи на сегодня</h2></div><button className="text-button" onClick={() => setSection('appointments')}>Все записи <ArrowRight size={15} /></button></div>
          {activeAppointments.length === 0 ? (
            <EmptyState title="Сегодня пока свободно" description="Новые записи из Telegram появятся здесь автоматически." />
          ) : (
            <div className="appointment-feed">
              {activeAppointments.slice(0, 6).map((appointment) => (
                <div className="appointment-row" key={appointment.id}>
                  <div className="appointment-time"><strong>{formatTime(appointment.startsAt, company.timezone)}</strong><span>{appointment.service.durationMinutes} мин</span></div>
                  <span className="appointment-line" style={{ backgroundColor: employeeColor(appointment.employee.id) }} />
                  <div className="appointment-client"><strong>{appointment.customer.firstName} {appointment.customer.lastName}</strong><span>{appointment.service.name} · {appointment.employee.firstName}</span></div>
                  <span className={`status-badge ${statusTone[appointment.status]}`}>{statusLabel[appointment.status]}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className={`panel bot-card ${bot.data?.status === 'ACTIVE' ? 'bot-card-active' : ''}`}>
          <span className="bot-card-icon"><Bot size={25} /></span>
          {bot.data?.status === 'ACTIVE' ? (
            <>
              <p className="eyebrow">Telegram подключён</p>
              <h2>@{bot.data.username}</h2>
              <p>Бот принимает записи и показывает клиентам только свободное время.</p>
              <div className="bot-health"><span /> Webhook активен</div>
              <button className="secondary-button light" onClick={() => setSection('bot')}>Настройки бота <ArrowRight size={16} /></button>
            </>
          ) : (
            <>
              <p className="eyebrow">Следующий шаг</p>
              <h2>Запись через Telegram</h2>
              <p>Подключите бота — клиенты смогут записываться круглосуточно без переписки.</p>
              <ul><li><Clock3 size={16} />Свободные слоты в реальном времени</li><li><CalendarCheck2 size={16} />Запись сразу в календаре</li></ul>
              <button className="secondary-button light" onClick={() => setSection('bot')}>Подключить бота <ArrowRight size={16} /></button>
            </>
          )}
        </article>
      </section>
    </>
  );
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof CalendarCheck2; label: string; value: string; note: string }) {
  return <article className="metric-card"><span className="metric-icon"><Icon size={19} /></span><div><p>{label}</p><strong>{value}</strong><span>{note}</span></div></article>;
}

function localDateKey(value: string, timezone: string) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const parts = Object.fromEntries(date.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function employeeColor(id: string) {
  const colors = ['#0f766e', '#2563eb', '#7c3aed', '#b45309'];
  return colors[id.charCodeAt(0) % colors.length];
}
