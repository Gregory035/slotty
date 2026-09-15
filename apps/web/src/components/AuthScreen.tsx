import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { trackEvent } from '../analytics';
import { login, register } from '../api';
import { useAppStore } from '../store';
import { errorMessage } from '../utils';
import { Brand } from './Brand';

export function AuthScreen() {
  const [searchParams] = useSearchParams();
  const setSession = useAppStore((state) => state.setSession);
  const [mode, setMode] = useState<'login' | 'register'>(() => searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const session = mode === 'login'
        ? await login({
            email: String(form.get('email')),
            password: String(form.get('password')),
          })
        : await register({
            email: String(form.get('email')),
            password: String(form.get('password')),
            firstName: String(form.get('firstName')),
            lastName: String(form.get('lastName') || '') || undefined,
          });
      if (mode === 'register') trackEvent('registration_success');
      setSession(session);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-form-wrap">
        <div className="auth-brand"><Brand /></div>
        <h1>{mode === 'login' ? 'С возвращением' : 'Создайте аккаунт'}</h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Войдите в рабочее пространство Slotty.'
            : 'Настройте онлайн-запись за несколько минут.'}
        </p>

        <div className="auth-tabs" role="tablist">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null); }}>Вход</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(null); trackEvent('registration_start'); }}>Регистрация</button>
        </div>

        <form className="form-stack" onSubmit={submit}>
          {mode === 'register' && (
            <div className="form-grid-2">
              <label>Имя<input name="firstName" required maxLength={50} placeholder="Алексей" /></label>
              <label>Фамилия<input name="lastName" maxLength={50} placeholder="Громов" /></label>
            </div>
          )}
          <label>Email<input name="email" required type="email" autoComplete="email" placeholder="owner@example.com" /></label>
          <label>Пароль<input name="password" required type="password" minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Минимум 8 символов" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            {!busy && <ArrowRight size={17} />}
          </button>
        </form>

        <p className="auth-legal">Продолжая, вы соглашаетесь с правилами сервиса и обработкой данных.</p>
      </section>

      <aside className="auth-product-preview" aria-hidden="true">
        <div className="auth-preview-copy">
          <p className="eyebrow">Онлайн-запись без переписки</p>
          <h2>Клиенты записываются сами — в Telegram.</h2>
          <p>Slotty показывает только свободное время и сразу добавляет запись в расписание.</p>
        </div>

        <section className="auth-preview-calendar">
          <header>
            <div>
              <span>Сегодня, 8 августа</span>
              <strong>Записи</strong>
            </div>
            <i>3</i>
          </header>
          <div className="auth-preview-slot">
            <time>10:00</time>
            <article><b>Елена Соколова</b><small>Стрижка · подтверждено</small></article>
          </div>
          <div className="auth-preview-slot">
            <time>13:30</time>
            <article className="is-lime"><b>Новая запись</b><small>Укладка · Telegram</small></article>
          </div>
          <div className="auth-preview-slot">
            <time>17:00</time>
            <article><b>Марина Ковалёва</b><small>Окрашивание · подтверждено</small></article>
          </div>
        </section>

      </aside>
    </main>
  );
}
