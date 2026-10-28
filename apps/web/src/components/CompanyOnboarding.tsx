import { useState, type FormEvent } from 'react';
import { ArrowRight, Building2, Check, Clock3 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCompany } from '../api';
import { useAppStore } from '../store';
import { errorMessage } from '../utils';
import { Brand } from './Brand';
import { Link } from 'react-router-dom';
import { LEGAL_DOCUMENT_VERSION } from '../legal';

export function CompanyOnboarding() {
  const queryClient = useQueryClient();
  const setActiveCompanyId = useAppStore((state) => state.setActiveCompanyId);
  const [error, setError] = useState<string | null>(null);
  const [workingMode, setWorkingMode] = useState<'SOLO' | 'TEAM'>('TEAM');
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
      workingMode,
      address: String(form.get('address') || '').trim() || undefined,
      name: String(form.get('name')),
      timezone: String(form.get('timezone')),
      currency: String(form.get('currency')),
      dataProcessingAccepted: true,
      legalVersion: LEGAL_DOCUMENT_VERSION,
    });
  }

  return (
    <main className="onboarding-layout">
      <div className="onboarding-brand"><Brand /></div>
      <section className="onboarding-card">
        <div className="onboarding-step"><span>1</span> · Основное</div>
        <span className="onboarding-icon"><Building2 size={28} /></span>
        <h1>Расскажите о вашем бизнесе</h1>
        <p>Эти данные нужны, чтобы правильно показывать время и цены клиентам.</p>
        <form className="form-stack onboarding-form" onSubmit={submit}>
          <fieldset className="service-checkboxes working-mode-options"><legend>Как вы работаете?</legend>
            <label><input type="radio" name="workingMode" checked={workingMode === 'SOLO'} onChange={() => setWorkingMode('SOLO')} /><span>Работаю один<small>Сам принимаю клиентов и управляю записью</small></span></label>
            <label><input type="radio" name="workingMode" checked={workingMode === 'TEAM'} onChange={() => setWorkingMode('TEAM')} /><span>У меня команда<small>Услуги оказывают несколько специалистов</small></span></label>
          </fieldset>
          <label>Название компании<input name="name" required maxLength={100} placeholder="Студия «Линия»" autoFocus /></label>
          <label>Адрес или формат приёма<input name="address" maxLength={300} placeholder="Адрес кабинета, онлайн или выезд к клиенту" /></label>
          <label>Часовой пояс
            <select name="timezone" defaultValue="Europe/Moscow">
              <option value="Europe/Moscow">Москва</option>
              <option value="Europe/Kaliningrad">Калининград</option>
              <option value="Asia/Yekaterinburg">Екатеринбург</option>
              <option value="Asia/Novosibirsk">Новосибирск</option>
              <option value="Asia/Vladivostok">Владивосток</option>
            </select>
          </label>
          <label className="legal-checkbox"><input name="dataProcessingAccepted" type="checkbox" required /><span>Я принимаю <Link to="/data-processing" target="_blank">поручение на обработку данных</Link> и подтверждаю полномочия на работу с данными клиентов.</span></label>
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
        <div className="onboarding-note"><Clock3 size={17} /><span>{workingMode === 'SOLO' ? 'Ваш профиль мастера создастся автоматически. Дальше — услуги, ваше расписание, Telegram и тестовая запись. Команду можно добавить позже.' : 'После создания Slotty проведёт вас по услугам, команде, расписанию, Telegram и тестовой записи.'}</span></div>
      </section>
      <div className="onboarding-progress" aria-label="Дальнейшая настройка после создания"><span className="active"><Check size={13} /></span><i /><span>2</span><i /><span>3</span><i /><span>4</span><i /><span>5</span></div>
    </main>
  );
}
