import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Plus, Scissors, Trash2 } from 'lucide-react';
import { createService, deleteService, getServices } from '../api';
import type { Company } from '../types';
import { errorMessage, formatMoney } from '../utils';
import { EmptyState, ErrorBlock, LoadingBlock, Modal, SectionHeader } from '../components/ui';

export function ServicesView({ company }: { company: Company }) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const services = useQuery({ queryKey: ['services', company.id], queryFn: () => getServices(company.id) });
  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createService>[1]) => createService(company.id, input),
    onSuccess: async () => {
      setModalOpen(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['services', company.id] });
    },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const deleteMutation = useMutation({
    mutationFn: (serviceId: string) => deleteService(company.id, serviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services', company.id] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    createMutation.mutate({
      name: String(form.get('name')),
      category: String(form.get('category') || '') || undefined,
      durationMinutes: Number(form.get('durationMinutes')),
      price: Number(form.get('price')),
      depositPercent: Number(form.get('depositPercent') || 0),
      depositFixedAmount: form.get('depositFixedAmount') ? Number(form.get('depositFixedAmount')) : undefined,
      description: String(form.get('description') || '') || undefined,
    });
  }

  return (
    <>
      <SectionHeader eyebrow="Каталог" title="Услуги" description="То, что клиенты увидят первым при записи через Telegram." action={<button className="primary-button" onClick={() => setModalOpen(true)}><Plus size={17} /> Новая услуга</button>} />
      {services.isLoading ? <LoadingBlock /> : services.error ? <ErrorBlock message="Не удалось загрузить услуги" /> : services.data?.length === 0 ? (
        <EmptyState title="Добавьте первую услугу" description="Укажите длительность и цену — после этого услугу можно назначить сотруднику." action={<button className="primary-button" onClick={() => setModalOpen(true)}><Plus size={16} /> Добавить услугу</button>} />
      ) : (
        <div className="service-grid">
          {services.data?.map((service) => (
            <article className="service-card" key={service.id}>
              <div className="service-card-top"><span className="service-icon"><Scissors size={21} /></span><span className={`status-dot-label ${service.isActive ? 'active' : ''}`}><i />{service.isActive ? 'Активна' : 'Скрыта'}</span></div>
              {service.category && <p className="service-category">{service.category}</p>}
              <h2>{service.name}</h2>
              {service.description && <p className="service-description">{service.description}</p>}
              <div className="service-meta"><span><Clock3 size={16} />{service.durationMinutes} минут{service.depositFixedAmount ? ` · предоплата ${formatMoney(service.depositFixedAmount, company.currency)}` : service.depositPercent > 0 ? ` · предоплата ${service.depositPercent}%` : ''}</span><strong>{formatMoney(service.price, company.currency)}</strong></div>
              <div className="card-actions"><button className="danger-text-button" disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(`Скрыть услугу «${service.name}»?`)) deleteMutation.mutate(service.id); }}><Trash2 size={15} /> Скрыть</button></div>
            </article>
          ))}
        </div>
      )}

      <Modal open={modalOpen} title="Новая услуга" description="Она появится у сотрудников после назначения." onClose={() => setModalOpen(false)}>
        <form className="form-stack modal-form" onSubmit={submit}>
          <label>Название<input name="name" required maxLength={120} placeholder="Женская стрижка" autoFocus /></label>
          <div className="form-grid-2"><label>Категория<input name="category" maxLength={100} placeholder="Стрижки" /></label><label>Длительность, мин<input name="durationMinutes" type="number" min={5} max={1440} step={5} defaultValue={60} required /></label></div>
          <div className="form-grid-2"><label>Цена, {company.currency}<input name="price" type="number" min={0} step="0.01" placeholder="2500" required /></label><label>Предоплата, %<input name="depositPercent" type="number" min={0} max={100} step={1} defaultValue={0} /></label><label>Или фиксированная предоплата, {company.currency}<input name="depositFixedAmount" type="number" min={0} step="0.01" placeholder="500" /></label></div>
          <label>Описание<textarea name="description" rows={3} maxLength={2000} placeholder="Что входит в услугу" /></label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Отмена</button><button className="primary-button" disabled={createMutation.isPending}>{createMutation.isPending ? 'Сохраняем…' : 'Добавить услугу'}</button></div>
        </form>
      </Modal>
    </>
  );
}
