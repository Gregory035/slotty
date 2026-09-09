import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, CircleSlash2, Plus, Search, UserX } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  createAppointment,
  getAppointments,
  getAvailability,
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
  return (
    <article className="appointment-list-row">
      <div className="appointment-date"><strong>{formatDateTime(appointment.startsAt, company.timezone).split(',').at(-1)}</strong><span>{appointment.service.durationMinutes} мин</span></div>
      <span className="avatar">{customerInitials(appointment.customer)}</span>
      <div className="appointment-person"><strong>{customerName}</strong><span>{appointment.source === 'DASHBOARD' ? appointment.customer.phone || 'Добавлен вручную' : customerSecondary(appointment.customer)}</span></div>
      <div className="appointment-service"><strong>{appointment.service.name}</strong><span>{appointment.employee.firstName} {appointment.employee.lastName}</span></div>
      <div className="appointment-price"><strong>{formatMoney(appointment.price, appointment.currency)}</strong><span className={`status-badge ${statusTone[appointment.status]}`}>{statusLabel[appointment.status]}</span>{appointment.depositStatus === 'PENDING' && <span className="deposit-badge">Предоплата {formatMoney(appointment.depositAmount, appointment.currency)}</span>}{appointment.depositStatus === 'PAID' && <span className="deposit-badge paid">Предоплата получена</span>}{appointment.review && <span className="review-badge" title={appointment.review.comment ?? 'Отзыв клиента'}>★ {appointment.review.rating}</span>}</div>
      {!terminal && <div className="row-action-menu">{canManage && <button disabled={busy} title="Перенести" onClick={reschedule}><CalendarDays size={16} /></button>}<button disabled={busy} title="Завершить" onClick={() => update('COMPLETED')}><Check size={16} /></button><button disabled={busy} title="Клиент не пришёл" onClick={() => update('NO_SHOW')}><UserX size={16} /></button><button disabled={busy} className="danger" title="Отменить" onClick={() => update('CANCELLED_BY_COMPANY')}><CircleSlash2 size={16} /></button></div>}
      {canManage && appointment.depositStatus === 'PENDING' && <div className="deposit-actions"><button className="secondary-button" disabled={depositBusy} onClick={() => updateDeposit('PAID')}>Предоплата получена</button><button className="text-button" disabled={depositBusy} onClick={() => updateDeposit('WAIVED')}>Без предоплаты</button></div>}
    </article>
  );
}

function CreateAppointmentModal({ company, open, onClose, initialCustomerId = '', initialServiceId = '', initialEmployeeId = '' }: { company: Company; open: boolean; onClose: () => void; initialCustomerId?: string; initialServiceId?: string; initialEmployeeId?: string }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [customerId, setCustomerId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState('');
  const [startsAt, setStartsAt] = useState('');
  useEffect(() => {
    if (!open) return;
    setCustomerId(initialCustomerId);
    setServiceId(initialServiceId);
    setEmployeeId(initialEmployeeId);
  }, [open, initialCustomerId, initialServiceId, initialEmployeeId]);
  const services = useQuery({ queryKey: ['services', company.id], queryFn: () => getServices(company.id), enabled: open });
  const employees = useQuery({ queryKey: ['employees', company.id], queryFn: () => getEmployees(company.id), enabled: open });
  const customers = useQuery({ queryKey: ['customers', company.id, 'booking'], queryFn: () => getCustomers(company.id), enabled: open });
  const availability = useQuery({
    queryKey: ['availability', company.id, employeeId, serviceId, date],
    queryFn: () => getAvailability(company.id, { employeeId, serviceId, date }),
    enabled: open && Boolean(employeeId && serviceId && date),
  });
  const mutation = useMutation({
    mutationFn: () => createAppointment(company.id, {
      ...(customerId ? { customerId } : { customer: { firstName } }),
      employeeId,
      serviceId,
      startsAt,
    }, crypto.randomUUID()),
    onSuccess: async () => {
      notify('Запись создана');
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['appointments', company.id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', company.id] });
    },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  const assignedEmployees = (employees.data ?? []).filter((employee) => employee.services.some((service) => service.id === serviceId));
  const valid = (customerId || firstName.trim()) && serviceId && employeeId && startsAt;
  return (
    <Modal open={open} title="Новая запись" description="Свободное время проверяется сервером перед сохранением." onClose={onClose}>
      <form className="modal-form form-stack" onSubmit={(event) => { event.preventDefault(); if (valid && !mutation.isPending) mutation.mutate(); }}>
        <label>Клиент<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Новый клиент</option>{customers.data?.items.map((customer) => <option key={customer.id} value={customer.id}>{customerDisplayName(customer)}</option>)}</select></label>
        {!customerId && <label>Имя нового клиента<input required maxLength={100} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>}
        <label>Услуга<select required value={serviceId} onChange={(event) => { setServiceId(event.target.value); setEmployeeId(''); setStartsAt(''); }}><option value="">Выберите услугу</option>{services.data?.filter((item) => item.isActive).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
        <label>Сотрудник<select required value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setStartsAt(''); }}><option value="">Выберите сотрудника</option>{assignedEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label>
        <label>Дата<input required type="date" value={date} onChange={(event) => { setDate(event.target.value); setStartsAt(''); }} /></label>
        <label>Время<select required value={startsAt} onChange={(event) => setStartsAt(event.target.value)}><option value="">{availability.isLoading ? 'Загружаем время…' : 'Выберите время'}</option>{availability.data?.slots.map((slot) => <option key={slot.startsAt} value={slot.startsAt}>{new Intl.DateTimeFormat('ru-RU', { timeZone: company.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(slot.startsAt))}</option>)}</select></label>
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
