import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAppointments, getEmployees, getOwnEmployeeProfile } from '../api';
import type { Appointment, Company } from '../types';
import { formatMoney, formatTime, statusLabel, statusTone } from '../utils';
import { addCalendarDays, calendarDate, calendarMonday, calendarMinutes, calendarQueryRange, formatCalendarDay } from '../calendar-time';
import { ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';
import { DialogLayer } from '../components/DialogLayer';

export function CalendarView({ company }: { company: Company }) {
  const navigate = useNavigate();
  const mobileDefault = window.matchMedia('(max-width: 820px)').matches;
  const [anchor, setAnchor] = useState(() => {
    const today = calendarDate(new Date(), company.timezone);
    return mobileDefault ? today : calendarMonday(today);
  });
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [view, setView] = useState<'week' | 'day'>(() => mobileDefault ? 'day' : 'week');
  const days = useMemo(() => Array.from({ length: view === 'day' ? 1 : 7 }, (_, index) => addCalendarDays(anchor, index)), [anchor, view]);
  const range = calendarQueryRange(days[0]!, days.at(-1)!);
  const appointments = useQuery({
    queryKey: ['appointments', company.id, 'calendar', range.from, range.to],
    queryFn: async () => {
      const items: Appointment[] = [];
      let cursor: string | undefined;
      do {
        const page = await getAppointments(company.id, { ...range, cursor, limit: 100 });
        items.push(...page.items);
        const next = page.hasMore ? page.nextCursor ?? undefined : undefined;
        if (next === cursor) break;
        cursor = next;
      } while (cursor);
      return items;
    },
  });
  const ownProfile = company.role === 'EMPLOYEE';
  const employees = useQuery({ queryKey: ownProfile ? ['employee-self', company.id, 'calendar'] : ['employees', company.id], queryFn: async () => ownProfile ? [await getOwnEmployeeProfile(company.id)] : getEmployees(company.id) });
  const inRange = useMemo(() => (appointments.data ?? []).filter((item) => days.includes(calendarDate(item.startsAt, company.timezone))), [appointments.data, days, company.timezone]);
  const firstHour = Math.min(9, ...inRange.map((item) => Math.floor(calendarMinutes(item.startsAt, company.timezone) / 60)));
  const lastHour = Math.min(24, Math.max(21, ...inRange.map((item) => Math.ceil((calendarMinutes(item.startsAt, company.timezone) + (Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60_000) / 60))));
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const shift = (direction: number) => setAnchor((date) => addCalendarDays(date, direction * (view === 'day' ? 1 : 7)));
  const today = () => { const date = calendarDate(new Date(), company.timezone); setAnchor(view === 'day' ? date : calendarMonday(date)); };
  const rangeLabel = days.length === 1 ? formatCalendarDay(days[0]!, { day: 'numeric', month: 'long' }) : `${formatCalendarDay(days[0]!, { day: 'numeric', month: 'long' })} — ${formatCalendarDay(days.at(-1)!, { day: 'numeric', month: 'long' })}`;

  return <>
    <SectionHeader eyebrow="Рабочее расписание" title="Календарь" description="Свободные слоты, команда и записи в одном рабочем поле." action={<button className="primary-button lime-button" onClick={() => navigate(`/companies/${company.id}/appointments`)}><Plus size={17} /> Новая запись</button>} />
    <section className="calendar-workspace">
      <header className="calendar-toolbar"><div className="calendar-nav"><button className="icon-button" onClick={() => shift(-1)} aria-label="Предыдущий период"><ChevronLeft size={18} /></button><button className="secondary-button" onClick={today}>Сегодня</button><button className="icon-button" onClick={() => shift(1)} aria-label="Следующий период"><ChevronRight size={18} /></button><strong>{rangeLabel}</strong></div><div className="calendar-switch"><button aria-pressed={view === 'day'} className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>День</button><button aria-pressed={view === 'week'} className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Неделя</button></div></header>
      {appointments.isLoading || employees.isLoading ? <LoadingBlock /> : appointments.error || employees.error ? <ErrorBlock message="Не удалось загрузить календарь" onRetry={() => { void appointments.refetch(); void employees.refetch(); }} /> : <div className="calendar-scroll"><div className={`calendar-grid calendar-grid-${days.length}`}>
        <div className="calendar-corner">{ownProfile ? 'Мой график' : employees.data?.length ? `${employees.data.length} в команде` : 'Команда'}</div>{days.map((day) => <div className="calendar-day-label" key={day}><span>{formatCalendarDay(day, { weekday: 'short' })}</span><b>{formatCalendarDay(day, { day: 'numeric' })}</b></div>)}
        <div className="calendar-times" style={{ height: hours.length * 72, gridTemplateRows: `repeat(${hours.length}, 72px)` }}>{hours.map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div>
        {days.map((day) => <CalendarDay key={day} items={inRange.filter((item) => calendarDate(item.startsAt, company.timezone) === day)} company={company} firstHour={firstHour} hourCount={hours.length} onSelect={setSelected} />)}
      </div></div>}
    </section>
    {selected && <DialogLayer className="calendar-drawer-layer" label="Детали записи" onClose={() => setSelected(null)}><aside className="appointment-drawer"><header><span className="eyebrow">Запись</span><button className="icon-button" onClick={() => setSelected(null)} aria-label="Закрыть"><X size={18} /></button></header><div className="drawer-avatar">{selected.customer.firstName.slice(0, 1)}{selected.customer.lastName?.slice(0, 1)}</div><h2>{selected.customer.firstName} {selected.customer.lastName}</h2><span className={`status-badge ${statusTone[selected.status]}`}>{statusLabel[selected.status]}</span><dl><div><dt>Услуга</dt><dd>{selected.service.name}</dd></div><div><dt>Время</dt><dd>{formatTime(selected.startsAt, company.timezone)} · {selected.service.durationMinutes} мин</dd></div><div><dt>Специалист</dt><dd>{selected.employee.firstName} {selected.employee.lastName}</dd></div><div><dt>Стоимость</dt><dd>{formatMoney(selected.price, selected.currency)}</dd></div></dl></aside></DialogLayer>}
  </>;
}

function CalendarDay({ items, company, firstHour, hourCount, onSelect }: { items: Appointment[]; company: Company; firstHour: number; hourCount: number; onSelect: (item: Appointment) => void }) {
  return <div className="calendar-day-column" style={{ height: hourCount * 72 }}>{items.map((item) => {
    const start = (calendarMinutes(item.startsAt, company.timezone) - firstHour * 60) * 72 / 60;
    const height = Math.max(38, (Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60_000 * 72 / 60);
    return <button className={`calendar-event ${statusTone[item.status]}`} style={{ top: `${start}px`, height: `${height}px` }} onClick={() => onSelect(item)} key={item.id}><b>{formatTime(item.startsAt, company.timezone)} · {item.customer.firstName}</b><span>{item.service.name}</span></button>;
  })}</div>;
}
