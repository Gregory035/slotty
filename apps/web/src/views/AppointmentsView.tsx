import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, CircleSlash2, Search, UserX } from 'lucide-react';
import { getAppointments, updateAppointmentStatus } from '../api';
import type { Appointment, AppointmentStatus, Company } from '../types';
import { errorMessage, formatDateTime, formatMoney, statusLabel, statusTone } from '../utils';
import { EmptyState, ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';

export function AppointmentsView({ company }: { company: Company }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | AppointmentStatus>('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const appointments = useQuery({ queryKey: ['appointments', company.id], queryFn: () => getAppointments(company.id) });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => updateAppointmentStatus(company.id, id, status, status === 'CANCELLED_BY_COMPANY' ? 'Отменено владельцем' : undefined),
    onSuccess: async () => { setError(null); await queryClient.invalidateQueries({ queryKey: ['appointments', company.id] }); },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (appointments.data ?? []).filter((item) => {
      const matchesStatus = filter === 'ALL' || item.status === filter;
      const haystack = `${item.customer.firstName} ${item.customer.lastName ?? ''} ${item.service.name} ${item.employee.firstName}`.toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [appointments.data, filter, search]);

  return (
    <>
      <SectionHeader eyebrow="Календарь" title="Записи" description="Все визиты из Telegram и их текущий статус." />
      <div className="toolbar">
        <div className="filter-pills">
          {([['ALL', 'Все'], ['CONFIRMED', 'Подтверждённые'], ['COMPLETED', 'Завершённые'], ['CANCELLED_BY_COMPANY', 'Отменённые']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Клиент, услуга, сотрудник" /></label>
      </div>
      {error && <ErrorBlock message={error} />}
      {appointments.isLoading ? <LoadingBlock /> : appointments.error ? <ErrorBlock message="Не удалось загрузить записи" /> : filtered.length === 0 ? (
        <EmptyState title="Записей не найдено" description="Измените фильтр или дождитесь первой записи из Telegram." />
      ) : (
        <div className="appointments-list">
          {groupByDay(filtered, company.timezone).map(([day, items]) => (
            <section className="appointment-day" key={day}>
              <div className="day-heading"><CalendarDays size={17} /><h2>{day}</h2><span>{items.length}</span></div>
              <div className="panel appointment-table">
                {items.map((appointment) => <AppointmentItem key={appointment.id} appointment={appointment} company={company} busy={statusMutation.isPending} update={(status) => statusMutation.mutate({ id: appointment.id, status })} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function AppointmentItem({ appointment, company, busy, update }: { appointment: Appointment; company: Company; busy: boolean; update: (status: AppointmentStatus) => void }) {
  const terminal = appointment.status.startsWith('CANCELLED') || appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW';
  return (
    <article className="appointment-list-row">
      <div className="appointment-date"><strong>{formatDateTime(appointment.startsAt, company.timezone).split(',').at(-1)}</strong><span>{appointment.service.durationMinutes} мин</span></div>
      <span className="avatar">{appointment.customer.firstName[0]}{appointment.customer.lastName?.[0]}</span>
      <div className="appointment-person"><strong>{appointment.customer.firstName} {appointment.customer.lastName}</strong><span>{appointment.customer.username ? `@${appointment.customer.username}` : 'Клиент Telegram'}</span></div>
      <div className="appointment-service"><strong>{appointment.service.name}</strong><span>{appointment.employee.firstName} {appointment.employee.lastName}</span></div>
      <div className="appointment-price"><strong>{formatMoney(appointment.price, appointment.currency)}</strong><span className={`status-badge ${statusTone[appointment.status]}`}>{statusLabel[appointment.status]}</span></div>
      {!terminal && <div className="row-action-menu"><button disabled={busy} title="Завершить" onClick={() => update('COMPLETED')}><Check size={16} /></button><button disabled={busy} title="Клиент не пришёл" onClick={() => update('NO_SHOW')}><UserX size={16} /></button><button disabled={busy} className="danger" title="Отменить" onClick={() => update('CANCELLED_BY_COMPANY')}><CircleSlash2 size={16} /></button></div>}
    </article>
  );
}

function groupByDay(items: Appointment[], timezone: string): Array<[string, Appointment[]]> {
  const formatter = new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long' });
  const groups = new Map<string, Appointment[]>();
  items.forEach((item) => { const key = formatter.format(new Date(item.startsAt)); groups.set(key, [...(groups.get(key) ?? []), item]); });
  return [...groups.entries()];
}
