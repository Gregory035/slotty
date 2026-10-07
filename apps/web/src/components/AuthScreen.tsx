import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { trackEvent } from '../analytics';
import { login, register, requestPasswordReset, resetPassword } from '../api';
import { useAppStore } from '../store';
import { errorMessage } from '../utils';
import { Brand } from './Brand';

export function AuthScreen() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const setSession = useAppStore((state) => state.setSession);
  const resetToken = new URLSearchParams(location.hash.replace(/^#/, '')).get('token') ?? '';
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(() => {
    if (searchParams.get('mode') === 'register') return 'register';
    if (searchParams.get('mode') === 'forgot-password') return 'forgot';
    if (searchParams.get('mode') === 'reset-password' && resetToken) return 'reset';
    return 'login';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: 'login' | 'register' | 'forgot') {
    setMode(next);
    setError(null);
    setNotice(null);
    navigate(next === 'login' ? '/app' : next === 'register' ? '/app?mode=register' : '/app?mode=forgot-password', { replace: true });
    if (next === 'register') trackEvent('registration_start');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      if (mode === 'forgot') {
        await requestPasswordReset({ email: String(form.get('email')) });
        setNotice('Если аккаунт с этим email существует, мы отправили ссылку для восстановления.');
        return;
      }
      if (mode === 'reset') {
        const password = String(form.get('password'));
        if (password !== String(form.get('passwordConfirmation'))) {
          setError('Пароли не совпадают');
          return;
        }
        await resetPassword({ token: resetToken, password });
        setMode('login');
        setNotice('Пароль обновлён. Теперь войдите с новым паролем.');
        navigate('/app', { replace: true });
        return;
      }
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
        <h1>{mode === 'login' ? 'С возвращением' : mode === 'register' ? 'Создайте аккаунт' : mode === 'forgot' ? 'Восстановить пароль' : 'Новый пароль'}</h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Войдите в рабочее пространство Slotty.'
            : mode === 'register'
              ? 'Настройте онлайн-запись за несколько минут.'
              : mode === 'forgot'
                ? 'Укажите email — отправим одноразовую ссылку для восстановления доступа.'
                : 'Задайте новый пароль. Ссылка работает один раз.'}
        </p>

        {(mode === 'login' || mode === 'register') && <div className="auth-tabs" role="tablist">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Вход</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Регистрация</button>
        </div>}

        <form className="form-stack" onSubmit={submit}>
          {mode === 'register' && (
            <div className="form-grid-2">
              <label>Имя<input name="firstName" required maxLength={50} placeholder="Алексей" /></label>
              <label>Фамилия<input name="lastName" maxLength={50} placeholder="Громов" /></label>
            </div>
          )}
          {mode !== 'reset' && <label>Email<input name="email" required type="email" autoComplete="email" placeholder="owner@example.com" /></label>}
          {mode !== 'forgot' && <label>Пароль<input name="password" required type="password" minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Минимум 8 символов" /></label>}
          {mode === 'reset' && <label>Повторите пароль<input name="passwordConfirmation" required type="password" minLength={8} maxLength={128} autoComplete="new-password" placeholder="Повторите новый пароль" /></label>}
          {error && <p className="form-error">{error}</p>}
          {notice && <p className="form-notice">{notice}</p>}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : mode === 'register' ? 'Создать аккаунт' : mode === 'forgot' ? 'Отправить ссылку' : 'Сохранить пароль'}
            {!busy && <ArrowRight size={17} />}
          </button>
        </form>

        {mode === 'login' && <button type="button" className="auth-link-button" onClick={() => switchMode('forgot')}>Забыли пароль?</button>}
        {(mode === 'forgot' || mode === 'reset') && <Link className="auth-link-button" to="/app" onClick={() => { setMode('login'); setError(null); setNotice(null); }}>Вернуться ко входу</Link>}

        {mode !== 'reset' && <p className="auth-legal">Продолжая, вы соглашаетесь с правилами сервиса и обработкой данных.</p>}
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
