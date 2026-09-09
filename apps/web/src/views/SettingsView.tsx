import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { updateCompany } from '../api';
import { useToast } from '../components/ToastProvider';
import { SectionHeader } from '../components/ui';
import type { Company } from '../types';
import { errorMessage } from '../utils';

export function SettingsView({ company }: { company: Company }) {
  const [form, setForm] = useState({
    name: company.name,
    phone: company.phone ?? '',
    email: company.email ?? '',
    address: company.address ?? '',
    timezone: company.timezone,
    currency: company.currency,
    minBookingNoticeMinutes: company.minBookingNoticeMinutes,
    maxBookingHorizonDays: company.maxBookingHorizonDays,
    slotStepMinutes: company.slotStepMinutes,
    cancellationNoticeMinutes: company.cancellationNoticeMinutes,
    allowAnyEmployee: company.allowAnyEmployee,
    rebookingDelayDays: company.rebookingDelayDays,
  });
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const mutation = useMutation({
    mutationFn: () => updateCompany(company.id, form),
    onSuccess: async () => { notify('Настройки сохранены'); await queryClient.invalidateQueries({ queryKey: ['companies'] }); },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <>
      <SectionHeader eyebrow="Компания" title="Настройки" description="Контакты, часовой пояс и правила онлайн-записи." />
      <form className="panel settings-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <section><h2>Профиль</h2><div className="form-grid-2"><label>Название<input required maxLength={160} value={form.name} onChange={(event) => set('name', event.target.value)} /></label><label>Телефон<input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></label><label>Email<input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></label><label>Адрес<input value={form.address} onChange={(event) => set('address', event.target.value)} /></label><label>Часовой пояс<input required value={form.timezone} onChange={(event) => set('timezone', event.target.value)} /></label><label>Валюта<input required maxLength={3} value={form.currency} onChange={(event) => set('currency', event.target.value.toUpperCase())} /></label></div></section>
        <section><h2>Онлайн-запись</h2><div className="form-grid-2"><NumberField label="Минимум до записи, мин" value={form.minBookingNoticeMinutes} setValue={(value) => set('minBookingNoticeMinutes', value)} min={0} /><NumberField label="Горизонт записи, дней" value={form.maxBookingHorizonDays} setValue={(value) => set('maxBookingHorizonDays', value)} min={1} /><NumberField label="Шаг слотов, мин" value={form.slotStepMinutes} setValue={(value) => set('slotStepMinutes', value)} min={5} /><NumberField label="Отмена не позднее, мин" value={form.cancellationNoticeMinutes} setValue={(value) => set('cancellationNoticeMinutes', value)} min={0} /></div><label className="toggle-field"><input type="checkbox" checked={form.allowAnyEmployee} onChange={(event) => set('allowAnyEmployee', event.target.checked)} /><span>Разрешить запись без выбора конкретного сотрудника</span></label></section>
        <section><h2>Удержание клиентов</h2><div className="form-grid-2"><NumberField label="Повторная запись через, дней" value={form.rebookingDelayDays} setValue={(value) => set('rebookingDelayDays', value)} min={1} /></div><p className="muted-text">После завершённой услуги Slotty предложит клиенту повторить запись в Telegram.</p></section>
        <div className="settings-actions"><button className="primary-button" disabled={mutation.isPending}><Save size={17} /> Сохранить</button></div>
      </form>
    </>
  );
}

function NumberField({ label, value, setValue, min }: { label: string; value: number; setValue: (value: number) => void; min: number }) {
  return <label>{label}<input type="number" min={min} required value={value} onChange={(event) => setValue(Number(event.target.value))} /></label>;
}
