import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, Clock3, LoaderCircle, Star, UserRound } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ApiError, createMiniAppBooking, getMiniAppAvailability, getMiniAppSession, getWorkExampleImageUrl } from '../api';
import type { MiniAppEmployee, MiniAppService, MiniAppSession } from '../types';
import { SlottyMark } from '../components/Brand';
import './telegram-miniapp.css';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready(): void;
        expand(): void;
        close(): void;
        HapticFeedback?: { selectionChanged(): void; impactOccurred(style: 'light' | 'medium'): void };
      };
    };
  }
}

type Step = 'service' | 'employee' | 'profile' | 'time' | 'success';

export function TelegramMiniAppPage() {
  const { companyId = '' } = useParams();
  const [initData, setInitData] = useState('');
  const [session, setSession] = useState<MiniAppSession | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('service');
  const [service, setService] = useState<MiniAppService | null>(null);
  const [employee, setEmployee] = useState<MiniAppEmployee | null>(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<Array<{ startsAt: string; endsAt: string }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    const telegram = window.Telegram?.WebApp;
    telegram?.ready();
    telegram?.expand();
    const currentInitData = telegram?.initData ?? '';
    setInitData(currentInitData);
    if (!currentInitData) {
      setError('Откройте запись из Telegram-бота компании.');
      setLoading(false);
      return;
    }
    let active = true;
    getMiniAppSession(companyId, currentInitData)
      .then((data) => {
        if (!active) return;
        setSession(data);
        setDate(todayInZone(data.company.timezone));
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(messageOf(requestError, 'Не удалось открыть запись. Вернитесь в бот и попробуйте ещё раз.'));
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [companyId]);

  useEffect(() => {
    if (!session || !service || !employee || !date || !initData || step !== 'time') return;
    let active = true;
    setSlotsLoading(true);
    setSelectedSlot(null);
    getMiniAppAvailability(companyId, {
      initData,
      serviceId: service.id,
      employeeId: employee.id,
      date,
    })
      .then((data) => active && setSlots(data.slots))
      .catch((requestError: unknown) => {
        if (!active) return;
        setSlots([]);
        setError(messageOf(requestError, 'Не удалось загрузить свободное время.'));
      })
      .finally(() => active && setSlotsLoading(false));
    return () => { active = false; };
  }, [companyId, date, employee, initData, service, session, step]);

  const dates = useMemo(() => {
    if (!session || !date) return [];
    return Array.from(
      { length: Math.min(session.company.maxBookingHorizonDays + 1, 14) },
      (_, offset) => addDays(todayInZone(session.company.timezone), offset),
    );
  }, [date, session]);

  const chooseService = (nextService: MiniAppService) => {
    haptic('light');
    setService(nextService);
    setEmployee(nextService.employees.length === 1 ? nextService.employees[0]! : null);
    setSelectedSlot(null);
    setError('');
    setStep(nextService.employees.length === 1 ? 'profile' : 'employee');
  };

  const chooseEmployee = (nextEmployee: MiniAppEmployee) => {
    haptic('light');
    setEmployee(nextEmployee);
    setSelectedSlot(null);
    setError('');
    setStep('profile');
  };

  const confirm = async () => {
    if (!service || !employee || !selectedSlot || !date) return;
    const time = timeInZone(selectedSlot.startsAt, session!.company.timezone);
    setBooking(true);
    setError('');
    try {
      await createMiniAppBooking(companyId, {
        initData,
        serviceId: service.id,
        employeeId: employee.id,
        date,
        time,
      });
      haptic('medium');
      setStep('success');
    } catch (requestError) {
      setError(messageOf(requestError, 'Это время уже заняли. Выберите другой слот.'));
      setSelectedSlot(null);
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <MiniAppState label="Открываем запись" />;
  if (error && !session) return <MiniAppState label={error} retry={() => window.location.reload()} />;
  if (!session) return null;

  const goBack = () => {
    if (step === 'time') return setStep('profile');
    if (step === 'profile') return setStep(service && service.employees.length > 1 ? 'employee' : 'service');
    setStep('service');
  };

  if (step === 'success') {
    return (
      <main className="miniapp-page miniapp-success">
        <div className="miniapp-success-icon"><Check size={34} /></div>
        <p className="miniapp-eyebrow">ЗАПИСЬ СОЗДАНА</p>
        <h1>До встречи!</h1>
        <p>{service!.name} · {employee!.name}</p>
        <p>{formatLongDate(date)} · {timeInZone(selectedSlot!.startsAt, session.company.timezone)}</p>
        <button className="miniapp-primary" onClick={() => window.Telegram?.WebApp?.close()}>Вернуться в Telegram</button>
      </main>
    );
  }

  return (
    <main className="miniapp-page">
      <header className="miniapp-header">
        <div className="miniapp-brand"><span><SlottyMark size={21} tone="dark" /></span><b>{session.company.name}</b></div>
        {step !== 'service' && <button className="miniapp-back" onClick={goBack} aria-label="Назад"><ChevronLeft size={21} /></button>}
      </header>

      <section className="miniapp-intro">
        <p className="miniapp-eyebrow">ОНЛАЙН-ЗАПИСЬ</p>
        <h1>{step === 'service' ? 'Выберите услугу' : step === 'employee' ? 'Выберите специалиста' : step === 'profile' ? 'О специалисте' : 'Выберите время'}</h1>
        {step === 'service' && <p>{session.company.description || 'Свободное время отображается сразу — без переписки и ожидания.'}</p>}
      </section>

      {error && <div className="miniapp-error" role="alert">{error}</div>}

      {step === 'service' && <section className="miniapp-service-list" aria-label="Услуги">
        {session.services.map((item) => (
          <button className="miniapp-service" key={item.id} onClick={() => chooseService(item)}>
            <span className="miniapp-service-icon">{item.photoUrl ? <img src={item.photoUrl} alt="" /> : <Clock3 size={20} />}</span>
            <span><b>{item.name}</b>{item.description && <small>{item.description}</small>}<em>{formatPrice(item.price, session.company.currency)} · {duration(item.durationMinutes)}</em></span>
            <ChevronLeft className="miniapp-forward" size={20} />
          </button>
        ))}
        {!session.services.length && <p className="miniapp-empty">Сейчас нет услуг для онлайн-записи.</p>}
      </section>}

      {step === 'employee' && service && <section className="miniapp-employee-list" aria-label="Специалисты">
        <button className="miniapp-choice-summary" onClick={() => setStep('service')}><span>{service.name}</span><small>{formatPrice(service.price, session.company.currency)} · {duration(service.durationMinutes)}</small></button>
        {service.employees.map((item) => (
          <button className="miniapp-employee" key={item.id} onClick={() => chooseEmployee(item)}>
            <Avatar employee={item} />
            <span><b>{item.name}</b><small>{item.description || 'Выберите время для записи'}</small></span>
            <ChevronLeft className="miniapp-forward" size={20} />
          </button>
        ))}
      </section>}

      {step === 'profile' && service && employee && <section className="miniapp-profile">
        <button className="miniapp-choice-summary" onClick={() => setStep(service.employees.length > 1 ? 'employee' : 'service')}><span>{service.name}</span><small>{formatPrice(service.price, session.company.currency)} · {duration(service.durationMinutes)}</small></button>
        <div className="miniapp-profile-head"><Avatar employee={employee} /><div><h2>{employee.name}</h2><span><Star size={14} fill="currentColor" />{employee.reviewsCount ? `${employee.rating} · ${employee.reviewsCount} ${reviewWord(employee.reviewsCount)}` : 'Пока без оценок'}</span></div></div>
        {employee.description && <p className="miniapp-profile-description">{employee.description}</p>}
        <div className="miniapp-profile-section"><h3>Отзывы</h3>{employee.reviews.length ? <div className="miniapp-carousel">{employee.reviews.map((review) => <article className="miniapp-review-card" key={review.id}><div><b>{review.customerName}</b><span>{'★'.repeat(review.rating)}</span></div><p>{review.comment || 'Клиент оставил оценку без комментария.'}</p></article>)}</div> : <p className="miniapp-empty">Отзывов пока нет.</p>}</div>
        <div className="miniapp-profile-section"><h3>Фото работ</h3>{employee.workExamples.length ? <div className="miniapp-carousel miniapp-work-carousel">{employee.workExamples.map((work) => <figure key={work.id}><img src={getWorkExampleImageUrl(work.id)} alt={work.caption || `Работа специалиста ${employee.name}`} loading="lazy" />{work.caption && <figcaption>{work.caption}</figcaption>}</figure>)}</div> : <p className="miniapp-empty">Специалист ещё не добавил примеры работ.</p>}</div>
        <button className="miniapp-primary" onClick={() => setStep('time')}>Выбрать время</button>
      </section>}

      {step === 'time' && service && employee && <section className="miniapp-time-step">
        <button className="miniapp-choice-summary" onClick={() => setStep('profile')}>
          <span>{service.name} · {employee.name}</span><small>{duration(service.durationMinutes)} · {formatPrice(service.price, session.company.currency)}</small>
        </button>
        <div className="miniapp-dates" role="tablist" aria-label="Даты">
          {dates.map((item) => <button key={item} className={item === date ? 'selected' : ''} onClick={() => { haptic('light'); setDate(item); }}><small>{weekday(item)}</small><b>{new Date(`${item}T12:00:00Z`).getUTCDate()}</b><small>{month(item)}</small></button>)}
        </div>
        <div className="miniapp-slots-heading"><CalendarDays size={18} /><span>{formatLongDate(date)}</span></div>
        {slotsLoading ? <MiniAppState label="Ищем свободное время" compact /> : slots.length ? <div className="miniapp-slots">{slots.map((slot) => <button key={slot.startsAt} className={slot.startsAt === selectedSlot?.startsAt ? 'selected' : ''} onClick={() => { haptic('light'); setSelectedSlot(slot); }}>{timeInZone(slot.startsAt, session.company.timezone)}</button>)}</div> : <p className="miniapp-empty">На эту дату свободного времени нет. Выберите другой день.</p>}
      </section>}

      {step === 'time' && <footer className="miniapp-bottom-action">
        {selectedSlot && <span>{formatLongDate(date)} · {timeInZone(selectedSlot.startsAt, session.company.timezone)}</span>}
        <button className="miniapp-primary" disabled={!selectedSlot || booking} onClick={() => void confirm()}>{booking ? <LoaderCircle className="miniapp-spin" size={19} /> : 'Подтвердить запись'}</button>
      </footer>}
    </main>
  );
}

function MiniAppState({ label, retry, compact = false }: { label: string; retry?: () => void; compact?: boolean }) {
  return <main className={`miniapp-state${compact ? ' compact' : ''}`}><LoaderCircle className="miniapp-spin" size={22} /><p>{label}</p>{retry && <button className="miniapp-primary" onClick={retry}>Попробовать снова</button>}</main>;
}

function Avatar({ employee }: { employee: MiniAppEmployee }) {
  return <span className="miniapp-avatar" style={{ background: employee.color }}>{employee.photoUrl ? <img src={employee.photoUrl} alt="" /> : <UserRound size={20} />}</span>;
}

function messageOf(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }
function haptic(style: 'light' | 'medium') { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style); }
function todayInZone(timezone: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()); }
function addDays(date: string, days: number) { const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); }
function timeInZone(value: string, timezone: string) { return new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)); }
function formatLongDate(value: string) { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00Z`)); }
function weekday(value: string) { return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)).replace('.', ''); }
function month(value: string) { return new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)).replace('.', ''); }
function duration(minutes: number) { return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ''}`; }
function formatPrice(price: string, currency: string) { return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(price))} ${currency}`; }
function reviewWord(count: number) { const mod10 = count % 10; const mod100 = count % 100; return mod10 === 1 && mod100 !== 11 ? 'отзыв' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'отзыва' : 'отзывов'; }
