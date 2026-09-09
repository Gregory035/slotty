import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAppointments, getEmployees } from '../api';
import type { Appointment, Company } from '../types';
import { formatMoney, formatTime, statusLabel, statusTone } from '../utils';
import { ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';

const hourRows = Array.from({ length: 12 }, (_, index) => index + 9);

export function CalendarView({ company }: { company: Company }) {
  const navigate = useNavigate();
  const mobileDefault = typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches;
  const [anchor, setAnchor] = useState(() => mobileDefault ? startDay(new Date()) : startMonday(new Date()));
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [view, setView] = useState<'week' | 'day'>(() => mobileDefault ? 'day' : 'week');
  const appointments = useQuery({ queryKey: ['appointments', company.id, 'calendar'], queryFn: () => getAppointments(company.id, { limit: 100 }) });
  const employees = useQuery({ queryKey: ['employees', company.id], queryFn: () => getEmployees(company.id) });
  const days = useMemo(() => Array.from({ length: view === 'day' ? 1 : 7 }, (_, index) => plusDays(anchor, index)), [anchor, view]);
  const inRange = useMemo(() => (appointments.data?.items ?? []).filter((item) => {
    const date = new Date(item.startsAt);
    return date >= days[0]! && date < plusDays(days.at(-1)!, 1);
  }), [appointments.data, days]);
  const shift = (direction: number) => setAnchor((date) => plusDays(date, direction * (view === 'day' ? 1 : 7)));

  return <>
    <SectionHeader eyebrow="Рабочее расписание" title="Календарь" description="Свободные слоты, команда и записи в одном рабочем поле." action={<button className="primary-button lime-button" onClick={() => navigate(`/companies/${company.id}/appointments`)}><Plus size={17} /> Новая запись</button>} />
    <section className="calendar-workspace">
      <header className="calendar-toolbar"><div className="calendar-nav"><button className="icon-button" onClick={() => shift(-1)} aria-label="Предыдущий период"><ChevronLeft size={18} /></button><button className="secondary-button" onClick={() => setAnchor(view === 'day' ? startDay(new Date()) : startMonday(new Date()))}>Сегодня</button><button className="icon-button" onClick={() => shift(1)} aria-label="Следующий период"><ChevronRight size={18} /></button><strong>{rangeLabel(days, company.timezone)}</strong></div><div className="calendar-switch"><button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>День</button><button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Неделя</button></div></header>
      {appointments.isLoading || employees.isLoading ? <LoadingBlock /> : appointments.error ? <ErrorBlock message="Не удалось загрузить календарь" /> : <div className="calendar-scroll"><div className={`calendar-grid calendar-grid-${days.length}`}>
        <div className="calendar-corner">{employees.data?.length ? `${employees.data.length} в команде` : 'Команда'}</div>{days.map((day) => <div className="calendar-day-label" key={day.toISOString()}><span>{new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: company.timezone }).format(day)}</span><b>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: company.timezone }).format(day)}</b></div>)}
        <div className="calendar-times">{hourRows.map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div>
        {days.map((day) => <CalendarDay key={day.toISOString()} day={day} items={inRange.filter((item) => isSameDay(new Date(item.startsAt), day))} company={company} onSelect={setSelected} />)}
      </div></div>}
    </section>
    {selected && <aside className="appointment-drawer" role="dialog" aria-label="Детали записи"><header><span className="eyebrow">Запись</span><button className="icon-button" onClick={() => setSelected(null)} aria-label="Закрыть"><X size={18} /></button></header><div className="drawer-avatar">{selected.customer.firstName.slice(0, 1)}{selected.customer.lastName?.slice(0, 1)}</div><h2>{selected.customer.firstName} {selected.customer.lastName}</h2><span className={`status-badge ${statusTone[selected.status]}`}>{statusLabel[selected.status]}</span><dl><div><dt>Услуга</dt><dd>{selected.service.name}</dd></div><div><dt>Время</dt><dd>{formatTime(selected.startsAt, company.timezone)} · {selected.service.durationMinutes} мин</dd></div><div><dt>Специалист</dt><dd>{selected.employee.firstName} {selected.employee.lastName}</dd></div><div><dt>Стоимость</dt><dd>{formatMoney(selected.price, selected.currency)}</dd></div></dl></aside>}
  </>;
}

function CalendarDay({ day, items, company, onSelect }: { day: Date; items: Appointment[]; company: Company; onSelect: (item: Appointment) => void }) {
  return <div className="calendar-day-column">{hourRows.map((hour) => <span className="calendar-hour-line" key={hour} />)}{items.map((item) => { const time = new Date(item.startsAt); const start = (time.getHours() - 9) * 72 + (time.getMinutes() / 60) * 72; const height = Math.max(38, item.service.durationMinutes / 60 * 72); return <button className={`calendar-event ${statusTone[item.status]}`} style={{ top: `${Math.max(0, start)}px`, height: `${height}px` }} onClick={() => onSelect(item)} key={item.id}><b>{formatTime(item.startsAt, company.timezone)} · {item.customer.firstName}</b><span>{item.service.name}</span></button>; })}</div>;
}
function startMonday(date: Date) { const copy = new Date(date); copy.setHours(0, 0, 0, 0); const day = (copy.getDay() + 6) % 7; copy.setDate(copy.getDate() - day); return copy; }
function startDay(date: Date) { const copy = new Date(date); copy.setHours(0, 0, 0, 0); return copy; }
function plusDays(date: Date, days: number) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function isSameDay(left: Date, right: Date) { return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate(); }
function rangeLabel(days: Date[], timeZone: string) { const format = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone }); return days.length === 1 ? format.format(days[0]!) : `${format.format(days[0]!)} — ${format.format(days.at(-1)!)}`; }
