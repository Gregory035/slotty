import { useState, type FormEvent } from 'react';
import { ArrowRight, Bot, CalendarCheck2, CheckCircle2 } from 'lucide-react';
import { login, register } from '../api';
import { useAppStore } from '../store';
import { errorMessage } from '../utils';
import { Brand } from './Brand';

export function AuthScreen() {
  const setSession = useAppStore((state) => state.setSession);
  const [mode, setMode] = useState<'login' | 'register'>('login');
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
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(null); }}>Регистрация</button>
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

        <div className="auth-feature-list">
          <span><CalendarCheck2 size={16} /> Единое расписание</span>
          <span><Bot size={16} /> Запись через Telegram</span>
          <span><CheckCircle2 size={16} /> 14 дней бесплатно</span>
        </div>
        <p className="auth-legal">Продолжая, вы соглашаетесь с правилами сервиса и обработкой данных.</p>
      </section>
    </main>
  );
}
