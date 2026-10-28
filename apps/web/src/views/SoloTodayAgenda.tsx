import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAppointments, getAvailability, getOwnEmployeeProfile, getServices, updateAppointmentStatus } from '../api';
import { calendarDate, calendarQueryRange } from '../calendar-time';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui';
import { useToast } from '../components/ToastProvider';
import type { Appointment, Company } from '../types';
import { customerDisplayName, errorMessage, formatTime, statusLabel, statusTone } from '../utils';
import { CreateAppointmentModal, RescheduleModal } from './AppointmentsView';

export function SoloTodayAgenda({ company }: { company: Company }) {
  const today = calendarDate(new Date(), company.timezone);
  const client = useQueryClient();
  const { notify } = useToast();
  const [creating, setCreating] = useState(false);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [serviceId, setServiceId] = useState('');
  const appointments = useQuery({
    queryKey: ['appointments', company.id, 'solo-today', today],
    queryFn: async () => {
      const items: Appointment[] = [];
      let cursor: string | undefined;
      do {
        const result = await getAppointments(company.id, { ...calendarQueryRange(today, today), employeeId: company.employeeId ?? undefined, order: 'asc', cursor, limit: 100 });
        items.push(...result.items);
        const next = result.hasMore ? result.nextCursor ?? undefined : undefined;
        if (next === cursor) break;
        cursor = next;
      } while (cursor);
      return items.filter((item) => calendarDate(item.startsAt, company.timezone) === today);
    },
    refetchInterval: 30_000,
  });
  const profile = useQuery({ queryKey: ['employee-self', company.id], queryFn: () => getOwnEmployeeProfile(company.id) });
  const services = useQuery({ queryKey: ['services', company.id], queryFn: () => getServices(company.id) });
  const activeServices = profile.data?.services.filter((item) => services.data?.some((service) => service.id === item.id && service.isActive)) ?? [];
  const selectedServiceId = activeServices.some((item) => item.id === serviceId) ? serviceId : activeServices[0]?.id ?? '';
  const availability = useQuery({
    queryKey: ['availability', company.id, company.employeeId, selectedServiceId, today],
    queryFn: () => getAvailability(company.id, { employeeId: company.employeeId!, serviceId: selectedServiceId, date: today }),
    enabled: Boolean(company.employeeId && selectedServiceId),
    refetchInterval: 30_000,
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'COMPLETED' | 'NO_SHOW' }) => updateAppointmentStatus(company.id, id, status),
    onSuccess: async () => {
      notify('Статус записи обновлён');
      await client.invalidateQueries({ queryKey: ['appointments', company.id] });
      await client.invalidateQueries({ queryKey: ['dashboard', company.id] });
      await client.invalidateQueries({ queryKey: ['availability', company.id] });
    },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  const items = appointments.data ?? [];
  const next = items.find((item) => ['PENDING', 'CONFIRMED'].includes(item.status) && Date.parse(item.endsAt) > Date.now());
  return <>
    <section className="panel solo-agenda">
      <div className="panel-title-row"><div><p className="eyebrow">Сегодня</p><h2>{next ? `Ближайший визит · ${formatTime(next.startsAt, company.timezone)}` : 'Ваш день'}</h2>{next && <p className="muted-text">{customerDisplayName(next.customer)} · {next.service.name}</p>}</div><button className="primary-button" onClick={() => setCreating(true)}>Новая запись</button></div>
      {appointments.isLoading ? <LoadingBlock /> : appointments.error ? <ErrorBlock message="Не удалось загрузить записи на сегодня" onRetry={() => void appointments.refetch()} /> : !items.length ? <EmptyState title="Сегодня пока свободно" description="Добавьте клиента вручную или отправьте ему ссылку на вашего Telegram-бота." /> : <div className="solo-agenda-list">{items.map((appointment) => {
        const phone = appointment.customer.phone?.replace(/[^+\d]/g, '');
        const username = appointment.customer.username;
        return <article key={appointment.id}>
          <time>{formatTime(appointment.startsAt, company.timezone)}–{formatTime(appointment.endsAt, company.timezone)}</time>
          <div><h3>{customerDisplayName(appointment.customer)}</h3><p>{appointment.service.name}</p><span className={`status-badge ${statusTone[appointment.status]}`}>{statusLabel[appointment.status]}</span></div>
          <div className="solo-agenda-actions">
            {appointment.status === 'CONFIRMED' && <><button className="secondary-button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: appointment.id, status: 'COMPLETED' })}>Услуга оказана</button><button className="text-button" disabled={statusMutation.isPending} onClick={() => { if (window.confirm('Отметить, что клиент не пришёл?')) statusMutation.mutate({ id: appointment.id, status: 'NO_SHOW' }); }}>Не пришёл</button></>}
            {['PENDING', 'CONFIRMED'].includes(appointment.status) && <button className="secondary-button" onClick={() => setRescheduling(appointment)}>Перенести</button>}
            {phone && <a className="secondary-button" href={`tel:${phone}`}>Позвонить</a>}
            {username && /^[a-z\d_]{5,32}$/i.test(username) && <a className="secondary-button" href={`https://t.me/${username}`} target="_blank" rel="noreferrer">Написать</a>}
          </div>
        </article>;
      })}</div>}
    </section>
    <section className="panel solo-agenda">
      <div className="panel-title-row"><div><p className="eyebrow">Свободные окна</p><h2>Время для записи сегодня</h2></div></div>
      {profile.isLoading || services.isLoading ? <LoadingBlock /> : profile.error || services.error ? <ErrorBlock message="Не удалось загрузить профиль и услуги" onRetry={() => { void profile.refetch(); void services.refetch(); }} /> : !activeServices.length ? <p className="muted-text">Добавьте услугу и настройте рабочие часы — здесь появится свободное время.</p> : <>
        <label className="inline-field">Для услуги<select value={selectedServiceId} onChange={(event) => setServiceId(event.target.value)}>{activeServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
        {availability.isLoading ? <LoadingBlock /> : availability.error ? <ErrorBlock message="Не удалось загрузить свободное время. Проверьте, что услуга активна." onRetry={() => void availability.refetch()} /> : availability.data?.slots.length ? <div className="solo-free-slots" aria-label="Доступное время">{availability.data.slots.map((slot) => <time key={slot.startsAt}>{formatTime(slot.startsAt, company.timezone)}</time>)}</div> : <p className="muted-text">Сегодня свободного времени для этой услуги нет. Другие дни доступны в календаре.</p>}
      </>}
    </section>
    <CreateAppointmentModal company={company} open={creating} onClose={() => setCreating(false)} />
    {rescheduling && <RescheduleModal company={company} appointment={rescheduling} onClose={() => setRescheduling(null)} />}
  </>;
}
