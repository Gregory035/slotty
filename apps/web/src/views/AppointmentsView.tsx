import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, Check, CircleSlash2, Plus, Search, UserX } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  createAppointment,
  createVisit,
  getAppointments,
  getAvailability,
  getAppointmentCalendar,
  getCustomers,
  getEmployees,
  getServices,
  rescheduleAppointment,
  updateDepositStatus,
  updateAppointmentStatus,
} from '../api';
import type { Appointment, AppointmentStatus, Company } from '../types';
import { customerDisplayName, customerInitials, customerSecondary, errorMessage, formatDateTime, formatMoney, statusLabel, statusTone } from '../utils';
import { EmptyState, ErrorBlock, LoadingBlock, Modal, SectionHeader } from '../components/ui';
import { useToast } from '../components/ToastProvider';

export function AppointmentsView({ company }: { company: Company }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const repeatCustomerId = params.get('customerId') ?? '';
  const repeatServiceId = params.get('serviceId') ?? '';
  const repeatEmployeeId = params.get('employeeId') ?? '';
  const [createOpen, setCreateOpen] = useState(Boolean(repeatCustomerId));
  const [reschedule, setReschedule] = useState<Appointment | null>(null);
  const status = params.get('status') as AppointmentStatus | null;
  const search = params.get('q') ?? '';
  const cursor = params.get('cursor') ?? undefined;
  const appointments = useQuery({
    queryKey: ['appointments', company.id, status, search, cursor],
    queryFn: () => getAppointments(company.id, { status: status ?? undefined, search, order: 'desc', cursor, limit: 25 }),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: AppointmentStatus }) =>
      updateAppointmentStatus(company.id, id, next, next === 'CANCELLED_BY_COMPANY' ? 'Отменено компанией' : undefined),
    onSuccess: async () => {
      notify('Статус записи обновлён');
      await queryClient.invalidateQueries({ queryKey: ['appointments', company.id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', company.id] });
    },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  const depositMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'PAID' | 'WAIVED' }) => updateDepositStatus(company.id, id, status),
    onSuccess: async () => {
      notify('Статус предоплаты обновлён');
      await queryClient.invalidateQueries({ queryKey: ['appointments', company.id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', company.id] });
    },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  const canManage = company.role !== 'EMPLOYEE';
  const items = appointments.data?.items ?? [];

  function setFilter(key: string, value?: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('cursor');
    setParams(next);
  }

  return (
    <>
      <SectionHeader
        eyebrow="Календарь"
        title="Записи"
        description="Записи из Telegram и веб-панели с серверными фильтрами."
        action={canManage ? <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={17} /> Новая запись</button> : undefined}
      />
      <div className="toolbar">
        <div className="filter-pills">
          {([['', 'Все'], ['CONFIRMED', 'Подтверждённые'], ['COMPLETED', 'Завершённые'], ['CANCELLED_BY_COMPANY', 'Отменённые']] as const).map(([value, label]) => (
            <button key={value || 'all'} className={(status ?? '') === value ? 'active' : ''} onClick={() => setFilter('status', value)}>{label}</button>
          ))}
        </div>
        <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setFilter('q', event.target.value)} placeholder="Клиент, услуга, сотрудник" /></label>
      </div>
      {appointments.isLoading ? <LoadingBlock /> : appointments.error ? <ErrorBlock message="Не удалось загрузить записи" /> : !items.length ? (
        <EmptyState title="Записей не найдено" description="Измените фильтр или создайте запись вручную." />
      ) : (
        <div className="appointments-list">
          {groupByDay(items, company.timezone).map(([day, dayItems]) => (
            <section className="appointment-day" key={day}>
              <div className="day-heading"><CalendarDays size={17} /><h2>{day}</h2><span>{dayItems.length}</span></div>
              <div className="panel appointment-table">
                {dayItems.map((appointment) => (
                  <AppointmentItem
                    key={appointment.id}
                    appointment={appointment}
                    company={company}
                    busy={statusMutation.isPending}
                    canManage={canManage}
                    reschedule={() => setReschedule(appointment)}
                    update={(next) => {
                      if (next !== 'CANCELLED_BY_COMPANY' || window.confirm('Отменить эту запись?')) {
                        statusMutation.mutate({ id: appointment.id, next });
                      }
                    }}
                    updateDeposit={(next) => depositMutation.mutate({ id: appointment.id, status: next })}
                    depositBusy={depositMutation.isPending}
                  />
                ))}
              </div>
            </section>
          ))}
          {appointments.data?.hasMore && <button className="secondary-button page-next" onClick={() => setFilter('cursor', appointments.data.nextCursor ?? undefined)}>Следующая страница</button>}
        </div>
      )}
      {canManage && <CreateAppointmentModal company={company} open={createOpen} initialCustomerId={repeatCustomerId} initialServiceId={repeatServiceId} initialEmployeeId={repeatEmployeeId} onClose={() => {
        setCreateOpen(false);
        if (repeatCustomerId) setParams({});
      }} />}
      {canManage && reschedule && <RescheduleModal company={company} appointment={reschedule} onClose={() => setReschedule(null)} />}
    </>
  );
}

function AppointmentItem({ appointment, company, busy, canManage, update, reschedule, updateDeposit, depositBusy }: { appointment: Appointment; company: Company; busy: boolean; canManage: boolean; update: (status: AppointmentStatus) => void; reschedule: () => void; updateDeposit: (status: 'PAID' | 'WAIVED') => void; depositBusy: boolean }) {
  const terminal = appointment.status.startsWith('CANCELLED') || appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW';
  const customerName = customerDisplayName(appointment.customer);
  const { notify } = useToast();
  async function downloadCalendar() {
    try {
      const blob = await getAppointmentCalendar(company.id, appointment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'slotty-appointment.ics';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) {
      notify(errorMessage(caught), 'error');
    }
  }
  return (
    <article className="appointment-list-row">
      <div className="appointment-date"><strong>{formatDateTime(appointment.startsAt, company.timezone).split(',').at(-1)}</strong><span>{appointment.service.durationMinutes} мин</span></div>
      <span className="avatar">{customerInitials(appointment.customer)}</span>
      <div className="appointment-person"><strong>{customerName}</strong><span>{appointment.source === 'DASHBOARD' ? appointment.customer.phone || 'Добавлен вручную' : customerSecondary(appointment.customer)}</span></div>
      <div className="appointment-service"><strong>{appointment.service.name}</strong><span>{appointment.employee.firstName} {appointment.employee.lastName}</span>{appointment.visitId && <small>Часть общего визита</small>}{appointment.recurrenceId && <small>Повторяющаяся запись</small>}</div>
      <div className="appointment-price"><strong>{formatMoney(appointment.price, appointment.currency)}</strong><span className={`status-badge ${statusTone[appointment.status]}`}>{statusLabel[appointment.status]}</span>{appointment.depositStatus === 'PENDING' && <span className="deposit-badge">Предоплата {formatMoney(appointment.depositAmount, appointment.currency)}</span>}{appointment.depositStatus === 'PAID' && <span className="deposit-badge paid">Предоплата получена</span>}{appointment.review && <span className="review-badge" title={appointment.review.comment ?? 'Отзыв клиента'}>★ {appointment.review.rating}</span>}</div>
      {!terminal && <div className="row-action-menu"><button type="button" title="Добавить в календарь" aria-label="Добавить в календарь" onClick={() => void downloadCalendar()}><CalendarPlus size={16} /></button>{canManage && <button disabled={busy} title="Перенести" onClick={reschedule}><CalendarDays size={16} /></button>}<button disabled={busy} title="Завершить" onClick={() => update('COMPLETED')}><Check size={16} /></button><button disabled={busy} title="Клиент не пришёл" onClick={() => update('NO_SHOW')}><UserX size={16} /></button><button disabled={busy} className="danger" title="Отменить" onClick={() => update('CANCELLED_BY_COMPANY')}><CircleSlash2 size={16} /></button></div>}
      {canManage && appointment.depositStatus === 'PENDING' && <div className="deposit-actions"><button className="secondary-button" disabled={depositBusy} onClick={() => updateDeposit('PAID')}>Предоплата получена</button><button className="text-button" disabled={depositBusy} onClick={() => updateDeposit('WAIVED')}>Без предоплаты</button></div>}
    </article>
  );
}

interface VisitFormItem { id: string; serviceId: string; employeeId: string; startsAt: string }

function dateInZone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function CreateAppointmentModal({ company, open, onClose, initialCustomerId = '', initialServiceId = '', initialEmployeeId = '' }: { company: Company; open: boolean; onClose: () => void; initialCustomerId?: string; initialServiceId?: string; initialEmployeeId?: string }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [customerId, setCustomerId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [items, setItems] = useState<VisitFormItem[]>([{ id: crypto.randomUUID(), serviceId: '', employeeId: '', startsAt: '' }]);
  const [date, setDate] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [intervalDays, setIntervalDays] = useState(7);
  const [repeatCount, setRepeatCount] = useState(2);
  const requestKey = useRef({ fingerprint: '', key: crypto.randomUUID() });
  useEffect(() => {
    if (!open) return;
    requestKey.current = { fingerprint: '', key: crypto.randomUUID() };
    setCustomerId(initialCustomerId);
    setItems([{ id: crypto.randomUUID(), serviceId: initialServiceId, employeeId: initialEmployeeId, startsAt: '' }]);
    setDate('');
  }, [open, initialCustomerId, initialServiceId, initialEmployeeId]);
  const services = useQuery({ queryKey: ['services', company.id], queryFn: () => getServices(company.id), enabled: open });
  const employees = useQuery({ queryKey: ['employees', company.id], queryFn: () => getEmployees(company.id), enabled: open });
  const customers = useQuery({ queryKey: ['customers', company.id, 'booking'], queryFn: () => getCustomers(company.id), enabled: open });
  const availability = useQueries({
    queries: items.map((item) => ({
      queryKey: ['availability', company.id, item.employeeId, item.serviceId, date],
      queryFn: () => getAvailability(company.id, { employeeId: item.employeeId, serviceId: item.serviceId, date }),
      enabled: open && Boolean(item.employeeId && item.serviceId && date),
    })),
  });
  function updateItem(index: number, changes: Partial<VisitFormItem>) {
    setItems((current) => current.map((item, position) => position === index
      ? { ...item, ...changes }
      : position > index ? { ...item, startsAt: '' } : item));
  }
  function slotsFor(index: number) {
    const slots = availability[index]?.data?.slots ?? [];
    if (index === 0) return slots;
    const previous = availability[index - 1]?.data?.slots.find((slot) => slot.startsAt === items[index - 1]?.startsAt);
    if (!previous) return [];
    const end = new Date(previous.endsAt).getTime();
    return slots.filter((slot) => {
      const start = new Date(slot.startsAt).getTime();
      return start >= end && start - end <= 60 * 60_000;
    });
  }
  const today = dateInZone(new Date(), company.timezone);
  const lastDate = date && repeat && Number.isInteger(intervalDays) && Number.isInteger(repeatCount) ? addCalendarDays(date, (repeatCount - 1) * intervalDays) : '';
  const horizonDate = addCalendarDays(today, company.maxBookingHorizonDays);
  const withinHorizon = !repeat || (Number.isInteger(intervalDays) && intervalDays >= 1 && intervalDays <= 365 && Number.isInteger(repeatCount) && repeatCount >= 2 && repeatCount <= 12 && Boolean(lastDate && lastDate <= horizonDate));
  const valid = Boolean((customerId || firstName.trim()) && items.length && items.every((item, index) => item.serviceId && item.employeeId && item.startsAt && slotsFor(index).some((slot) => slot.startsAt === item.startsAt)) && withinHorizon);
  const mutation = useMutation({
    mutationFn: async () => {
      const customer = customerId ? { customerId } : { customer: { firstName } };
      const first = items[0];
      if (!first) throw new Error('Выберите услугу');
      const fingerprint = JSON.stringify({ customer, items: items.map(({ serviceId, employeeId, startsAt }) => ({ serviceId, employeeId, startsAt })), repeat, intervalDays, repeatCount });
      if (requestKey.current.fingerprint !== fingerprint) requestKey.current = { fingerprint, key: crypto.randomUUID() };
      if (items.length === 1 && !repeat) {
        await createAppointment(company.id, {
        ...customer,
          employeeId: first.employeeId,
          serviceId: first.serviceId,
          startsAt: first.startsAt,
        }, requestKey.current.key);
        return;
      }
      await createVisit(company.id, {
        ...customer,
        items: items.map(({ serviceId, employeeId, startsAt }) => ({ serviceId, employeeId, startsAt })),
        ...(repeat ? { recurrence: { intervalDays, count: repeatCount } } : {}),
      }, requestKey.current.key);
    },
    onSuccess: async () => {
      notify(repeat ? 'Повторяющиеся записи созданы' : items.length > 1 ? 'Визит создан' : 'Запись создана');
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['appointments', company.id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', company.id] });
    },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  return (
    <Modal open={open} title="Новая запись" description="Выберите одну или несколько услуг. Каждую может выполнить свой специалист." onClose={onClose}>
      <form className="modal-form form-stack" onSubmit={(event) => { event.preventDefault(); if (valid && !mutation.isPending) mutation.mutate(); }}>
        <label>Клиент<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Новый клиент</option>{customers.data?.items.map((customer) => <option key={customer.id} value={customer.id}>{customerDisplayName(customer)}</option>)}</select></label>
        {!customerId && <label>Имя нового клиента<input required maxLength={100} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>}
        <label>Дата<input required type="date" value={date} onChange={(event) => { setDate(event.target.value); setItems((current) => current.map((item) => ({ ...item, startsAt: '' }))); }} /></label>
        {items.map((item, index) => {
          const assigned = (employees.data ?? []).filter((employee) => employee.services.some((service) => service.id === item.serviceId));
          return <div className="visit-form-item" key={item.id}>
            <div className="visit-form-heading"><strong>Услуга {index + 1}</strong>{items.length > 1 && <button type="button" className="text-button" onClick={() => setItems((current) => current.filter((_, position) => position !== index).map((entry, position) => position >= index ? { ...entry, startsAt: '' } : entry))}>Убрать</button>}</div>
            <label>Услуга<select required value={item.serviceId} onChange={(event) => updateItem(index, { serviceId: event.target.value, employeeId: '', startsAt: '' })}><option value="">Выберите услугу</option>{services.data?.filter((service) => service.isActive).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
            <label>Специалист<select required value={item.employeeId} onChange={(event) => updateItem(index, { employeeId: event.target.value, startsAt: '' })}><option value="">Выберите специалиста</option>{assigned.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label>
            <label>Время<select required value={item.startsAt} onChange={(event) => updateItem(index, { startsAt: event.target.value })}><option value="">{availability[index]?.isLoading ? 'Загружаем время…' : 'Выберите время'}</option>{slotsFor(index).map((slot) => <option key={slot.startsAt} value={slot.startsAt}>{new Intl.DateTimeFormat('ru-RU', { timeZone: company.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(slot.startsAt))}</option>)}</select></label>
          </div>;
        })}
        {items.length < 5 && <button type="button" className="secondary-button" onClick={() => setItems((current) => [...current, { id: crypto.randomUUID(), serviceId: '', employeeId: '', startsAt: '' }])}>+ Добавить услугу</button>}
        <label className="visit-repeat-toggle"><input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} /> Повторять визит</label>
        {repeat && <div className="visit-repeat-fields"><label>Каждые N дней<input type="number" min={1} max={365} required value={intervalDays} onChange={(event) => setIntervalDays(Number(event.target.value))} /></label><label>Всего визитов<input type="number" min={2} max={12} required value={repeatCount} onChange={(event) => setRepeatCount(Number(event.target.value))} /></label></div>}
        {repeat && !withinHorizon && <p className="form-hint">Повторения должны помещаться в период доступной записи ({company.maxBookingHorizonDays} дней).</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={!valid || mutation.isPending}>Создать запись</button></div>
      </form>
    </Modal>
  );
}

function RescheduleModal({ company, appointment, onClose }: { company: Company; appointment: Appointment; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [date, setDate] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const availability = useQuery({
    queryKey: ['availability', company.id, appointment.employee.id, appointment.service.id, date],
    queryFn: () => getAvailability(company.id, { employeeId: appointment.employee.id, serviceId: appointment.service.id, date }),
    enabled: Boolean(date),
  });
  const mutation = useMutation({
    mutationFn: () => rescheduleAppointment(company.id, appointment.id, { startsAt }),
    onSuccess: async () => {
      notify('Запись перенесена');
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['appointments', company.id] });
    },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  return (
    <Modal open title="Перенести запись" description={`${customerDisplayName(appointment.customer)} · ${appointment.service.name}`} onClose={onClose}>
      <form className="modal-form form-stack" onSubmit={(event) => { event.preventDefault(); if (startsAt) mutation.mutate(); }}>
        <label>Новая дата<input required type="date" value={date} onChange={(event) => { setDate(event.target.value); setStartsAt(''); }} /></label>
        <label>Новое время<select required value={startsAt} onChange={(event) => setStartsAt(event.target.value)}><option value="">Выберите время</option>{availability.data?.slots.map((slot) => <option key={slot.startsAt} value={slot.startsAt}>{new Intl.DateTimeFormat('ru-RU', { timeZone: company.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(slot.startsAt))}</option>)}</select></label>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={!startsAt || mutation.isPending}>Перенести</button></div>
      </form>
    </Modal>
  );
}

function groupByDay(items: Appointment[], timezone: string): Array<[string, Appointment[]]> {
  const formatter = new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long' });
  const groups = new Map<string, Appointment[]>();
  items.forEach((item) => { const key = formatter.format(new Date(item.startsAt)); groups.set(key, [...(groups.get(key) ?? []), item]); });
  return [...groups.entries()];
}
