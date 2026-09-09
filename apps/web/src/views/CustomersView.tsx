import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { anonymizeCustomer, getCustomer, getCustomers, setCustomerBlacklist, updateCustomer } from '../api';
import { useToast } from '../components/ToastProvider';
import { EmptyState, ErrorBlock, LoadingBlock, Modal, SectionHeader } from '../components/ui';
import type { Company, Customer, CustomerAppointment } from '../types';
import { customerDisplayName, customerInitials, customerSecondary, errorMessage, formatDateTime, formatMoney, statusLabel } from '../utils';

export function CustomersView({ company }: { company: Company }) {
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Customer | null>(null);
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const search = params.get('q') ?? '';
  const cursor = params.get('cursor') ?? undefined;
  const customers = useQuery({
    queryKey: ['customers', company.id, search, cursor],
    queryFn: () => getCustomers(company.id, search, cursor),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['customers', company.id] });
  const blacklist = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => setCustomerBlacklist(company.id, id, value),
    onSuccess: async () => { notify('Статус клиента обновлён'); await invalidate(); },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  const anonymize = useMutation({
    mutationFn: (id: string) => anonymizeCustomer(company.id, id),
    onSuccess: async () => { notify('Персональные данные удалены'); await invalidate(); },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  function setParam(key: string, value?: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'cursor') next.delete('cursor');
    setParams(next);
  }

  return (
    <>
      <SectionHeader eyebrow="CRM" title="Клиенты" description="История посещений, заметки, отмены и ограничения записи." />
      <div className="toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setParam('q', event.target.value)} placeholder="Имя, username или телефон" /></label></div>
      {customers.isLoading ? <LoadingBlock /> : customers.error ? <ErrorBlock message="Не удалось загрузить клиентов" /> : !customers.data?.items.length ? (
        <EmptyState title="Клиентов пока нет" description="Они появятся после первой записи или ручного создания записи." />
      ) : (
        <div className="customer-grid">
          {customers.data.items.map((customer) => (
            <article className="panel customer-card" key={customer.id}>
              <div className="customer-head"><span className="avatar avatar-large">{customerInitials(customer)}</span><div><h2>{customerDisplayName(customer)}</h2><p>{customerSecondary(customer)}</p></div>{customer.isBlacklisted && <span className="status-badge badge-red">Заблокирован</span>}</div>
              <div className="customer-stats"><div><strong>{customer.statistics.appointments}</strong><span>записей</span></div><div><strong>{customer.statistics.completed}</strong><span>визитов</span></div><div><strong>{customer.statistics.cancelled + customer.statistics.noShow}</strong><span>проблем</span></div><div><strong>{formatMoney(customer.statistics.revenue, company.currency)}</strong><span>выручка</span></div></div>
              {customer.notes && <p className="customer-notes">{customer.notes}</p>}
              {!customer.anonymizedAt && <div className="card-action-row"><button className="secondary-button" onClick={() => setEditing(customer)}>Карточка</button><button className="icon-button" title={customer.isBlacklisted ? 'Разблокировать' : 'Заблокировать'} onClick={() => blacklist.mutate({ id: customer.id, value: !customer.isBlacklisted })}>{customer.isBlacklisted ? <ShieldCheck size={17} /> : <Ban size={17} />}</button><button className="icon-button danger" title="Удалить персональные данные" onClick={() => { if (window.confirm('Необратимо анонимизировать персональные данные клиента?')) anonymize.mutate(customer.id); }}><Trash2 size={17} /></button></div>}
            </article>
          ))}
          {customers.data.hasMore && <button className="secondary-button page-next" onClick={() => setParam('cursor', customers.data.nextCursor ?? undefined)}>Следующая страница</button>}
        </div>
      )}
      {editing && <CustomerModal company={company} customer={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function CustomerModal({ company, customer, onClose }: { company: Company; customer: Customer; onClose: () => void }) {
  const [firstName, setFirstName] = useState(customer.firstName);
  const [phone, setPhone] = useState(customer.phone ?? '');
  const [notes, setNotes] = useState(customer.notes ?? '');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const details = useQuery({ queryKey: ['customer', company.id, customer.id], queryFn: () => getCustomer(company.id, customer.id) });
  const mutation = useMutation({
    mutationFn: () => updateCustomer(company.id, customer.id, { firstName, phone, notes }),
    onSuccess: async () => { notify('Карточка клиента сохранена'); onClose(); await queryClient.invalidateQueries({ queryKey: ['customers', company.id] }); },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  const repeat = details.data?.recentAppointments.find((appointment) => appointment.status === 'COMPLETED') ?? details.data?.recentAppointments[0];
  function repeatBooking(appointment?: CustomerAppointment) {
    const target = appointment ?? repeat;
    if (!target) return;
    onClose();
    navigate(`/companies/${company.id}/appointments?customerId=${customer.id}&serviceId=${target.service.id}&employeeId=${target.employee.id}`);
  }
  return (
    <Modal open title="Карточка клиента" description={`Всего записей: ${customer.statistics.appointments}`} onClose={onClose}>
      <form className="modal-form form-stack" onSubmit={(event) => { event.preventDefault(); if (firstName.trim()) mutation.mutate(); }}>
        <label>Имя<input maxLength={100} required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
        <label>Телефон<input maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>Внутренняя заметка<textarea maxLength={2000} rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {details.isLoading ? <LoadingBlock label="Загружаем историю" /> : details.data && <>
          <div className="customer-modal-insights">
            <div><strong>{details.data.statistics.averageRating ? `${details.data.statistics.averageRating} ★` : '—'}</strong><span>{details.data.statistics.reviewsCount} отзывов</span></div>
            <div><strong>{details.data.favoriteService?.name ?? '—'}</strong><span>любимая услуга</span></div>
            <div><strong>{details.data.favoriteEmployee?.name ?? '—'}</strong><span>любимый специалист</span></div>
          </div>
          <div className="customer-history">
            <h3>Предстоящие записи</h3>
            {details.data.upcomingAppointments.length ? details.data.upcomingAppointments.map((appointment) => <HistoryRow key={appointment.id} appointment={appointment} company={company} />) : <span>Нет предстоящих записей</span>}
            <h3>История</h3>
            {details.data.recentAppointments.slice(0, 8).map((appointment) => <HistoryRow key={appointment.id} appointment={appointment} company={company} />)}
          </div>
          {repeat && <button type="button" className="secondary-button" onClick={() => repeatBooking()}>Повторить последнюю запись</button>}
        </>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={mutation.isPending}>Сохранить</button></div>
      </form>
    </Modal>
  );
}

function HistoryRow({ appointment, company }: { appointment: CustomerAppointment; company: Company }) {
  return <div className="customer-history-row"><div><strong>{appointment.service.name}</strong><span>{appointment.employee.firstName} {appointment.employee.lastName}</span></div><div><strong>{formatDateTime(appointment.startsAt, company.timezone)}</strong><span>{statusLabel[appointment.status]}</span></div></div>;
}
