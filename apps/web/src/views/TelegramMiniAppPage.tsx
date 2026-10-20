import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, Clock3, LoaderCircle, RotateCcw, Star, UserRound, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ApiError, cancelMiniAppAppointment, createMiniAppVisit, getMiniAppAppointments, getMiniAppAvailability, getMiniAppSession, getWorkExampleImageUrl, rescheduleMiniAppAppointment, trackMiniAppEvent } from '../api';
import type { MiniAppAppointment, MiniAppAppointments, MiniAppEmployee, MiniAppService, MiniAppSession } from '../types';
import { SlottyMark } from '../components/Brand';
import './telegram-miniapp.css';

declare global { interface Window { Telegram?: { WebApp?: { initData: string; ready(): void; expand(): void; close(): void; HapticFeedback?: { selectionChanged(): void; impactOccurred(style: 'light' | 'medium'): void } } } } }

type Step = 'service' | 'employee' | 'profile' | 'time' | 'review' | 'success';
type Mode = 'booking' | 'appointments';
type AppointmentTab = 'upcoming' | 'history';
type Slot = { startsAt: string; endsAt: string; employeeId?: string };
type VisitItem = { serviceId: string; serviceName: string; employeeId: string; employeeName: string; date: string; time: string; startsAt: string; endsAt: string; price: string };

export function TelegramMiniAppPage() {
  const { companyId = '' } = useParams();
  const [initData, setInitData] = useState('');
  const [session, setSession] = useState<MiniAppSession | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('booking');
  const [step, setStep] = useState<Step>('service');
  const [service, setService] = useState<MiniAppService | null>(null);
  const [employee, setEmployee] = useState<MiniAppEmployee | null>(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [appointments, setAppointments] = useState<MiniAppAppointments | null>(null);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentTab, setAppointmentTab] = useState<AppointmentTab>('upcoming');
  const [rescheduling, setRescheduling] = useState<MiniAppAppointment | null>(null);
  const [visitItems, setVisitItems] = useState<VisitItem[]>([]);
  const [visitRequestId, setVisitRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const telegram = window.Telegram?.WebApp;
    telegram?.ready(); telegram?.expand();
    const currentInitData = telegram?.initData ?? '';
    setInitData(currentInitData);
    if (!currentInitData) { setError('Откройте запись из Telegram-бота компании.'); setLoading(false); return; }
    let active = true;
    getMiniAppSession(companyId, currentInitData)
      .then((data) => { if (active) { setSession(data); setDate(todayInZone(data.company.timezone)); } })
      .catch((requestError: unknown) => { if (active) setError(messageOf(requestError, 'Не удалось открыть запись. Вернитесь в бот и попробуйте ещё раз.')); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [companyId]);

  const loadAvailability = useCallback(async (targetDate: string, targetEmployee = employee) => {
    if (!session || !service || !targetDate || !initData) return [];
    const data = await getMiniAppAvailability(companyId, { initData, serviceId: service.id, ...(targetEmployee ? { employeeId: targetEmployee.id } : {}), date: targetDate });
    if (!visitItems.length || rescheduling) return data.slots;
    const previous = [...visitItems].sort((left, right) => left.startsAt.localeCompare(right.startsAt)).at(-1)!;
    const previousEnd = new Date(previous.endsAt).getTime();
    return data.slots.filter((slot) => {
      const start = new Date(slot.startsAt).getTime();
      return start >= previousEnd && start - previousEnd <= 60 * 60_000;
    });
  }, [companyId, employee, initData, rescheduling, service, session, visitItems]);

  useEffect(() => {
    if (!session || !service || !date || !initData || step !== 'time') return;
    let active = true;
    setSlotsLoading(true); setSelectedSlot(null);
    loadAvailability(date)
      .then((data) => active && setSlots(data))
      .catch((requestError: unknown) => { if (active) { setSlots([]); setError(messageOf(requestError, 'Не удалось загрузить свободное время.')); } })
      .finally(() => active && setSlotsLoading(false));
    return () => { active = false; };
  }, [date, initData, loadAvailability, service, session, step]);

  const dates = useMemo(() => session ? Array.from({ length: session.company.maxBookingHorizonDays + 1 }, (_, offset) => addDays(todayInZone(session.company.timezone), offset)) : [], [session]);

  const loadAppointments = useCallback(async () => {
    if (!initData) return;
    setAppointmentsLoading(true); setError('');
    try { setAppointments(await getMiniAppAppointments(companyId, initData)); }
    catch (requestError) { setError(messageOf(requestError, 'Не удалось загрузить записи.')); }
    finally { setAppointmentsLoading(false); }
  }, [companyId, initData]);

  useEffect(() => { if (mode === 'appointments') void loadAppointments(); }, [loadAppointments, mode]);

  const chooseService = (nextService: MiniAppService) => {
    haptic('light'); setService(nextService); setEmployee(nextService.employees.length === 1 ? nextService.employees[0]! : null); setSelectedSlot(null); setError('');
    void trackMiniAppEvent(companyId, initData, 'SERVICE_SELECTED').catch(() => undefined);
    setStep(nextService.employees.length === 1 ? 'profile' : 'employee');
  };
  const chooseEmployee = (nextEmployee: MiniAppEmployee | null) => { haptic('light'); setEmployee(nextEmployee); setSelectedSlot(null); setError(''); setStep(nextEmployee ? 'profile' : 'time'); };

  const findNearest = async () => {
    setSlotsLoading(true); setError('');
    try {
      for (const item of dates) {
        const available = await loadAvailability(item);
        if (available.length) { setDate(item); setSlots(available); setSelectedSlot(available[0]!); return; }
      }
      setError('В пределах доступного периода свободного времени нет.');
    } catch (requestError) { setError(messageOf(requestError, 'Не удалось найти ближайшее время.')); }
    finally { setSlotsLoading(false); }
  };

  const confirm = async () => {
    if (!service || !selectedSlot || !date || !session) return;
    const selectedEmployee = employee ?? service.employees.find((item) => item.id === selectedSlot.employeeId);
    if (!selectedEmployee) return;
    const time = timeInZone(selectedSlot.startsAt, session.company.timezone);
    setBusy(true); setError('');
    const wasRescheduling = Boolean(rescheduling);
    try {
      if (rescheduling) {
        await rescheduleMiniAppAppointment(companyId, { initData, appointmentId: rescheduling.id, date, time });
        haptic('medium'); setEmployee(selectedEmployee); setStep('success'); setAppointments(null);
      } else {
        setVisitItems((current) => [...current, { serviceId: service.id, serviceName: service.name, employeeId: selectedEmployee.id, employeeName: selectedEmployee.name, date, time, startsAt: selectedSlot.startsAt, endsAt: selectedSlot.endsAt, price: service.price }].sort((left, right) => left.startsAt.localeCompare(right.startsAt)));
        setEmployee(selectedEmployee); setStep('review');
      }
      if (!wasRescheduling) setRescheduling(null);
    } catch (requestError) {
      setError(messageOf(requestError, 'Это время уже заняли. Выберите другой слот.')); setSelectedSlot(null);
      try { setSlots(await loadAvailability(date)); } catch { setSlots([]); }
    } finally { setBusy(false); }
  };

  const submitVisit = async () => {
    if (!visitItems.length) return;
    setBusy(true); setError('');
    try {
      await createMiniAppVisit(companyId, { initData, requestId: visitRequestId, items: visitItems.map(({ serviceId, employeeId, date: itemDate, time }) => ({ serviceId, employeeId, date: itemDate, time })) });
      haptic('medium'); setStep('success'); setAppointments(null);
    } catch (requestError) {
      setError(messageOf(requestError, 'Не удалось создать визит. Проверьте выбранное время.'));
    } finally { setBusy(false); }
  };

  const addAnotherService = () => {
    setService(null); setEmployee(null); setSelectedSlot(null); setStep('service');
  };

  const cancelAppointment = async (appointment: MiniAppAppointment) => {
    if (!window.confirm('Отменить эту запись?')) return;
    setBusy(true); setError('');
    try { await cancelMiniAppAppointment(companyId, initData, appointment.id); haptic('medium'); await loadAppointments(); }
    catch (requestError) { setError(messageOf(requestError, 'Не удалось отменить запись.')); }
    finally { setBusy(false); }
  };

  const startFromAppointment = (appointment: MiniAppAppointment, isReschedule: boolean) => {
    const nextService = session?.services.find((item) => item.id === appointment.serviceId);
    const nextEmployee = nextService?.employees.find((item) => item.id === appointment.employeeId);
    if (!nextService || !nextEmployee || !session) { setError('Эта услуга или специалист больше недоступны.'); return; }
    setService(nextService); setEmployee(nextEmployee); setDate(todayInZone(session.company.timezone)); setSelectedSlot(null); setRescheduling(isReschedule ? appointment : null); setMode('booking'); setStep('time');
  };

  if (loading) return <MiniAppState label="Открываем запись" />;
  if (error && !session) return <MiniAppState label={error} retry={() => window.location.reload()} />;
  if (!session) return null;

  const goBack = () => { if (step === 'review') return setStep('time'); if (step === 'time') return setStep(employee ? 'profile' : 'employee'); if (step === 'profile') return setStep(service && service.employees.length > 1 ? 'employee' : 'service'); setStep('service'); };

  if (step === 'success') return <main className="miniapp-page miniapp-success">
    <div className="miniapp-success-icon"><Check size={34} /></div><p className="miniapp-eyebrow">ГОТОВО</p><h1>{rescheduling ? 'Запись перенесена' : 'До встречи!'}</h1>
    <p>{rescheduling ? `${service!.name} · ${employee!.name}` : `${visitItems.length} ${serviceWord(visitItems.length)} в визите`}</p><p>{rescheduling ? `${formatLongDate(date)} · ${timeInZone(selectedSlot!.startsAt, session.company.timezone)}` : formatLongDate(visitItems[0]!.date)}</p>
    <button className="miniapp-primary" onClick={() => { setRescheduling(null); setVisitItems([]); setVisitRequestId(crypto.randomUUID()); setMode('appointments'); setStep('service'); }}>Мои записи</button>
    <button className="miniapp-secondary" onClick={() => window.Telegram?.WebApp?.close()}>Вернуться в Telegram</button>
  </main>;

  const appointmentItems = appointmentTab === 'upcoming' ? appointments?.upcoming ?? [] : appointments?.history ?? [];
  return <main className="miniapp-page">
    <header className="miniapp-header"><div className="miniapp-brand"><span><SlottyMark size={21} tone="dark" /></span><b>{session.company.name}</b></div>{mode === 'booking' && step !== 'service' && <button className="miniapp-back" onClick={goBack} aria-label="Назад"><ChevronLeft size={21} /></button>}</header>
    <nav className="miniapp-nav" aria-label="Разделы"><button className={mode === 'booking' ? 'selected' : ''} onClick={() => { setMode('booking'); setError(''); }}>Записаться</button><button className={mode === 'appointments' ? 'selected' : ''} onClick={() => { setMode('appointments'); setError(''); }}>Мои записи</button></nav>
    {error && <div className="miniapp-error" role="alert">{error}</div>}
    {mode === 'appointments' ? <AppointmentsView appointments={appointments} loading={appointmentsLoading} tab={appointmentTab} setTab={setAppointmentTab} items={appointmentItems} timezone={session.company.timezone} currency={session.company.currency} busy={busy} onCancel={(item) => void cancelAppointment(item)} onReschedule={(item) => startFromAppointment(item, true)} onRepeat={(item) => startFromAppointment(item, false)} /> : <>
      <section className="miniapp-intro"><p className="miniapp-eyebrow">ОНЛАЙН-ЗАПИСЬ</p><h1>{step === 'service' ? 'Выберите услугу' : step === 'employee' ? 'Выберите специалиста' : step === 'profile' ? 'О специалисте' : step === 'review' ? 'Ваш визит' : rescheduling ? 'Новое время' : 'Выберите время'}</h1>{step === 'service' && <p>{session.company.description || 'Свободное время отображается сразу — без переписки и ожидания.'}</p>}</section>
      {step === 'service' && <section className="miniapp-service-list" aria-label="Услуги">{session.services.map((item) => <button className="miniapp-service" key={item.id} onClick={() => chooseService(item)}><span className="miniapp-service-icon">{item.photoUrl ? <img src={item.photoUrl} alt="" /> : <Clock3 size={20} />}</span><span><b>{item.name}</b>{item.description && <small>{item.description}</small>}<em>{formatPrice(item.price, session.company.currency)} · {duration(item.durationMinutes)}</em></span><ChevronLeft className="miniapp-forward" size={20} /></button>)}{!session.services.length && <p className="miniapp-empty">Сейчас нет услуг для онлайн-записи.</p>}</section>}
      {step === 'employee' && service && <section className="miniapp-employee-list" aria-label="Специалисты"><button className="miniapp-choice-summary" onClick={() => setStep('service')}><span>{service.name}</span><small>{formatPrice(service.price, session.company.currency)} · {duration(service.durationMinutes)}</small></button>{session.company.allowAnyEmployee && <button className="miniapp-employee miniapp-any-employee" onClick={() => chooseEmployee(null)}><span className="miniapp-avatar"><UserRound size={20} /></span><span><b>Любой специалист</b><small>Покажем ближайшее время у всей команды</small></span><ChevronLeft className="miniapp-forward" size={20} /></button>}{service.employees.map((item) => <button className="miniapp-employee" key={item.id} onClick={() => chooseEmployee(item)}><Avatar employee={item} /><span><b>{item.name}</b><small>{item.description || 'Выберите время для записи'}</small></span><ChevronLeft className="miniapp-forward" size={20} /></button>)}</section>}
      {step === 'profile' && service && employee && <section className="miniapp-profile"><button className="miniapp-choice-summary" onClick={() => setStep(service.employees.length > 1 ? 'employee' : 'service')}><span>{service.name}</span><small>{formatPrice(service.price, session.company.currency)} · {duration(service.durationMinutes)}</small></button><div className="miniapp-profile-head"><Avatar employee={employee} /><div><h2>{employee.name}</h2><span><Star size={14} fill="currentColor" />{employee.reviewsCount ? `${employee.rating} · ${employee.reviewsCount} ${reviewWord(employee.reviewsCount)}` : 'Пока без оценок'}</span></div></div>{employee.description && <p className="miniapp-profile-description">{employee.description}</p>}<div className="miniapp-profile-section"><h3>Отзывы</h3>{employee.reviews.length ? <div className="miniapp-carousel">{employee.reviews.map((review) => <article className="miniapp-review-card" key={review.id}><div><b>{review.customerName}</b><span>{'★'.repeat(review.rating)}</span></div><p>{review.comment || 'Клиент оставил оценку без комментария.'}</p></article>)}</div> : <p className="miniapp-empty">Отзывов пока нет.</p>}</div><div className="miniapp-profile-section"><h3>Фото работ</h3>{employee.workExamples.length ? <div className="miniapp-carousel miniapp-work-carousel">{employee.workExamples.map((work) => <figure key={work.id}><img src={getWorkExampleImageUrl(work.id)} alt={work.caption || `Работа специалиста ${employee.name}`} loading="lazy" />{work.caption && <figcaption>{work.caption}</figcaption>}</figure>)}</div> : <p className="miniapp-empty">Специалист ещё не добавил примеры работ.</p>}</div><button className="miniapp-primary" onClick={() => setStep('time')}>Выбрать время</button></section>}
      {step === 'time' && service && <section className="miniapp-time-step"><button className="miniapp-choice-summary" onClick={() => setStep(employee ? 'profile' : 'employee')}><span>{service.name} · {employee?.name ?? 'любой специалист'}</span><small>{duration(service.durationMinutes)} · {formatPrice(service.price, session.company.currency)}</small></button><div className="miniapp-date-tools"><label><CalendarDays size={18} /><span>Дата</span><input type="date" value={date} min={dates[0]} max={dates.at(-1)} onChange={(event) => setDate(event.target.value)} /></label><button className="miniapp-secondary" disabled={slotsLoading} onClick={() => void findNearest()}><Clock3 size={17} />Ближайшее время</button></div><div className="miniapp-dates" role="tablist" aria-label="Даты">{dates.map((item) => <button key={item} className={item === date ? 'selected' : ''} onClick={() => { haptic('light'); setDate(item); }}><small>{weekday(item)}</small><b>{new Date(`${item}T12:00:00Z`).getUTCDate()}</b><small>{month(item)}</small></button>)}</div><div className="miniapp-slots-heading"><CalendarDays size={18} /><span>{formatLongDate(date)}</span></div>{slotsLoading ? <MiniAppState label="Ищем свободное время" compact /> : slots.length ? <div className="miniapp-slots">{slots.map((slot) => <button key={`${slot.employeeId ?? employee?.id}:${slot.startsAt}`} className={slot.startsAt === selectedSlot?.startsAt && slot.employeeId === selectedSlot?.employeeId ? 'selected' : ''} onClick={() => { haptic('light'); setSelectedSlot(slot); void trackMiniAppEvent(companyId, initData, 'TIME_SELECTED').catch(() => undefined); }}>{timeInZone(slot.startsAt, session.company.timezone)}{!employee && <small>{service.employees.find((item) => item.id === slot.employeeId)?.name}</small>}</button>)}</div> : <p className="miniapp-empty">На эту дату свободного времени нет. Выберите другой день.</p>}</section>}
      {step === 'review' && <section className="miniapp-visit-review"><div className="miniapp-visit-list">{visitItems.map((item, index) => <article key={`${item.serviceId}:${item.startsAt}`}><span>{index + 1}</span><div><b>{item.serviceName}</b><small>{item.employeeName} · {formatLongDate(item.date)}, {item.time}</small></div><button aria-label={`Удалить ${item.serviceName}`} onClick={() => setVisitItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={17} /></button></article>)}</div><button className="miniapp-secondary" onClick={addAnotherService}>Добавить ещё услугу</button><p className="miniapp-visit-note">Услуги могут выполнять разные специалисты. Время внутри одного визита должно идти по порядку.</p></section>}
      {step === 'time' && <footer className="miniapp-bottom-action">{selectedSlot && <span>{formatLongDate(date)} · {timeInZone(selectedSlot.startsAt, session.company.timezone)}</span>}<button className="miniapp-primary" disabled={!selectedSlot || busy} onClick={() => void confirm()}>{busy ? <LoaderCircle className="miniapp-spin" size={19} /> : rescheduling ? 'Перенести запись' : 'Добавить в визит'}</button></footer>}
      {step === 'review' && <footer className="miniapp-bottom-action"><span>{visitItems.length ? `${visitItems.length} ${serviceWord(visitItems.length)}` : 'Добавьте хотя бы одну услугу'}</span><button className="miniapp-primary" disabled={!visitItems.length || busy} onClick={() => void submitVisit()}>{busy ? <LoaderCircle className="miniapp-spin" size={19} /> : 'Подтвердить визит'}</button></footer>}
    </>}
  </main>;
}

function AppointmentsView({ appointments, loading, tab, setTab, items, timezone, currency, busy, onCancel, onReschedule, onRepeat }: { appointments: MiniAppAppointments | null; loading: boolean; tab: AppointmentTab; setTab(tab: AppointmentTab): void; items: MiniAppAppointment[]; timezone: string; currency: string; busy: boolean; onCancel(item: MiniAppAppointment): void; onReschedule(item: MiniAppAppointment): void; onRepeat(item: MiniAppAppointment): void }) {
  return <section className="miniapp-appointments"><div className="miniapp-intro"><p className="miniapp-eyebrow">ВАШИ ВИЗИТЫ</p><h1>Мои записи</h1></div><div className="miniapp-appointment-tabs"><button className={tab === 'upcoming' ? 'selected' : ''} onClick={() => setTab('upcoming')}>Предстоящие {appointments?.upcoming.length ?? ''}</button><button className={tab === 'history' ? 'selected' : ''} onClick={() => setTab('history')}>История</button></div>{loading ? <MiniAppState label="Загружаем записи" compact /> : items.length ? <div className="miniapp-appointment-list">{items.map((item) => <article className="miniapp-appointment-card" key={item.id}><p className="miniapp-eyebrow">{appointmentStatus(item.status)}</p><h2>{item.serviceName}</h2><p>{formatAppointmentDate(item.startsAt, timezone)} · {item.employeeName}</p><strong>{formatPrice(item.price, currency)}</strong><div>{tab === 'upcoming' && <><button disabled={busy} onClick={() => onReschedule(item)}><CalendarDays size={16} />Перенести</button><button disabled={busy} className="danger" onClick={() => onCancel(item)}><X size={16} />Отменить</button></>}<button disabled={busy} onClick={() => onRepeat(item)}><RotateCcw size={16} />Повторить</button></div></article>)}</div> : <p className="miniapp-empty">{tab === 'upcoming' ? 'Предстоящих записей нет.' : 'История пока пуста.'}</p>}</section>;
}

function MiniAppState({ label, retry, compact = false }: { label: string; retry?: () => void; compact?: boolean }) { return <main className={`miniapp-state${compact ? ' compact' : ''}`}><LoaderCircle className="miniapp-spin" size={22} /><p>{label}</p>{retry && <button className="miniapp-primary" onClick={retry}>Попробовать снова</button>}</main>; }
function Avatar({ employee }: { employee: MiniAppEmployee }) { return <span className="miniapp-avatar" style={{ background: employee.color }}>{employee.photoUrl ? <img src={employee.photoUrl} alt="" /> : <UserRound size={20} />}</span>; }
function messageOf(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }
function haptic(style: 'light' | 'medium') { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style); }
function todayInZone(timezone: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()); }
function addDays(date: string, days: number) { const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); }
function timeInZone(value: string, timezone: string) { return new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)); }
function formatLongDate(value: string) { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00Z`)); }
function formatAppointmentDate(value: string, timezone: string) { return new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function weekday(value: string) { return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)).replace('.', ''); }
function month(value: string) { return new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)).replace('.', ''); }
function duration(minutes: number) { return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ''}`; }
function formatPrice(price: string, currency: string) { return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(price))} ${currency}`; }
function reviewWord(count: number) { const mod10 = count % 10; const mod100 = count % 100; return mod10 === 1 && mod100 !== 11 ? 'отзыв' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'отзыва' : 'отзывов'; }
function serviceWord(count: number) { const mod10 = count % 10; const mod100 = count % 100; return mod10 === 1 && mod100 !== 11 ? 'услуга' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'услуги' : 'услуг'; }
function appointmentStatus(status: MiniAppAppointment['status']) { return ({ PENDING: 'Ожидает подтверждения', CONFIRMED: 'Подтверждена', COMPLETED: 'Завершена', CANCELLED_BY_CUSTOMER: 'Отменена вами', CANCELLED_BY_COMPANY: 'Отменена компанией', NO_SHOW: 'Неявка' } as const)[status]; }
