import { useState, type FormEvent } from 'react';
import { ArrowRight, Bot, CalendarCheck2, CheckCircle2, Sparkles } from 'lucide-react';
import { login, register } from '../api';
import { useAppStore } from '../store';
import { errorMessage } from '../utils';

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
      const session =
        mode === 'login'
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
      <section className="auth-brand-panel">
        <div className="brand-lockup brand-lockup-light">
          <span className="brand-mark"><Sparkles size={20} /></span>
          <span>Slotty</span>
        </div>
        <div className="auth-promise">
          <span className="auth-kicker">Запись работает, пока вы заняты</span>
          <h1>Клиенты выбирают время сами. Вы управляете бизнесом.</h1>
          <p>
            Расписание, услуги, команда и Telegram-запись — в одном спокойном рабочем пространстве.
          </p>
        </div>
        <div className="auth-feature-list">
          <div><CalendarCheck2 size={20} /><span>Свободные слоты без пересечений</span></div>
          <div><Bot size={20} /><span>Telegram-бот принимает записи 24/7</span></div>
          <div><CheckCircle2 size={20} /><span>14 дней бесплатно, без карты</span></div>
        </div>
        <p className="auth-quote">«Ни одной потерянной записи — всё перед глазами»</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <span className="brand-mark"><Sparkles size={18} /></span>
            <span>Slotty</span>
          </div>
          <p className="eyebrow">Панель владельца</p>
          <h2>{mode === 'login' ? 'С возвращением' : 'Создайте аккаунт'}</h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Войдите, чтобы открыть расписание на сегодня.'
              : 'Начните настраивать онлайн-запись за несколько минут.'}
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
              {busy ? 'Подождите…' : mode === 'login' ? 'Войти в панель' : 'Создать аккаунт'}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>
          <p className="auth-legal">Продолжая, вы соглашаетесь с правилами сервиса и обработкой данных.</p>
        </div>
      </section>
    </main>
  );
}
