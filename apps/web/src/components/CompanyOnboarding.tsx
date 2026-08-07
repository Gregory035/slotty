import { useState, type FormEvent } from 'react';
import { ArrowRight, Building2, Check, Clock3 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCompany } from '../api';
import { useAppStore } from '../store';
import { errorMessage } from '../utils';
import { Brand } from './Brand';

export function CompanyOnboarding() {
  const queryClient = useQueryClient();
  const setActiveCompanyId = useAppStore((state) => state.setActiveCompanyId);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: createCompany,
    onSuccess: async (company) => {
      setActiveCompanyId(company.id);
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      name: String(form.get('name')),
      timezone: String(form.get('timezone')),
      currency: String(form.get('currency')),
    });
  }

  return (
    <main className="onboarding-layout">
      <div className="onboarding-brand"><Brand /></div>
      <section className="onboarding-card">
        <div className="onboarding-step"><span>1</span> из 3 · Основное</div>
        <span className="onboarding-icon"><Building2 size={28} /></span>
        <h1>Расскажите о вашем бизнесе</h1>
        <p>Эти данные нужны, чтобы правильно показывать время и цены клиентам.</p>
        <form className="form-stack onboarding-form" onSubmit={submit}>
          <label>Название компании<input name="name" required maxLength={100} placeholder="Студия «Линия»" autoFocus /></label>
          <label>Часовой пояс
            <select name="timezone" defaultValue="Europe/Moscow">
              <option value="Europe/Moscow">Москва</option>
              <option value="Europe/Kaliningrad">Калининград</option>
              <option value="Asia/Yekaterinburg">Екатеринбург</option>
              <option value="Asia/Novosibirsk">Новосибирск</option>
              <option value="Asia/Vladivostok">Владивосток</option>
            </select>
          </label>
          <label>Валюта
            <select name="currency" defaultValue="RUB">
              <option value="RUB">Российский рубль · ₽</option>
              <option value="KZT">Казахстанский тенге · ₸</option>
              <option value="USD">Доллар США · $</option>
              <option value="EUR">Евро · €</option>
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={mutation.isPending}>Продолжить <ArrowRight size={17} /></button>
        </form>
        <div className="onboarding-note"><Clock3 size={17} /><span>Пробный период включится автоматически на 14 дней.</span></div>
      </section>
      <div className="onboarding-progress"><span className="active"><Check size={13} /></span><i /><span>2</span><i /><span>3</span></div>
    </main>
  );
}
