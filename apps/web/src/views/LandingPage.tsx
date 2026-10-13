import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowRight, CalendarCheck2, Check, ChevronRight, CircleCheck,
  MessageCircleMore, RotateCcw, Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SlottyMark } from '../components/Brand';
import { trackEvent } from '../analytics';
import { MarketingLayout } from './MarketingLayout';

const services = [
  { id: 'haircut', name: 'Стрижка', duration: 60, employee: 'Елена', price: '2 500 ₽' },
  { id: 'manicure', name: 'Маникюр', duration: 90, employee: 'Мария', price: '2 200 ₽' },
] as const;

const demoTimes = ['10:00', '12:30', '15:00'] as const;

const setupSteps = [
  ['01', 'Добавьте услуги и специалистов', 'Укажите цены, длительность и рабочие часы.'],
  ['02', 'Подключите Telegram-бота', 'Клиенты откроют запись в Mini App.'],
  ['03', 'Принимайте записи', 'Новые визиты появятся в расписании Slotty.'],
] as const;

const faqItems = [
  ['Как клиент записывается?', 'Открывает Mini App из Telegram-бота, выбирает услугу, специалиста и время.'],
  ['Нужна ли клиенту регистрация?', 'Нет. Отдельная учётная запись в Slotty ему не нужна.'],
  ['Сколько длится пробный период?', '14 дней после создания компании. Банковская карта для старта не нужна.'],
] as const;

export function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('is-visible', entry.isIntersecting);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    nodes.forEach((node) => {
      node.classList.add('reveal-ready');
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  function moveHeroGlow(event: ReactPointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    event.currentTarget.style.setProperty('--hero-pointer-x', `${x}%`);
    event.currentTarget.style.setProperty('--hero-pointer-y', `${y}%`);
  }

  function resetHeroGlow() {
    heroRef.current?.style.setProperty('--hero-pointer-x', '50%');
    heroRef.current?.style.setProperty('--hero-pointer-y', '48%');
  }

  return (
    <MarketingLayout>
      <section className="landing-hero" ref={heroRef} onPointerMove={moveHeroGlow} onPointerLeave={resetHeroGlow}>
        <span className="landing-hero-cursor-glow" aria-hidden="true" />
        <span className="landing-hero-mark" aria-hidden="true"><SlottyMark size={44} tone="light" /></span>
        <p className="eyebrow">Онлайн-запись для бизнеса услуг</p>
        <h1>Slotty</h1>
        <p className="landing-hero-tagline">Клиент бронирует время в Telegram Mini App.<br />Вы видите запись в Slotty.</p>
        <div className="landing-actions">
          <Link className="primary-button lime-button" to="/app?mode=register" onClick={() => { trackEvent('landing_start_trial'); trackEvent('registration_start', { source: 'home' }); }}>Начать бесплатно <ArrowRight size={17} /></Link>
          <a className="text-button" href="#demo" onClick={() => trackEvent('landing_view_demo')}>Попробовать демо <ChevronRight size={15} /></a>
        </div>
        <span className="landing-note">14 дней бесплатно · без карты</span>
      </section>

      <BookingDemo />

      <section className="landing-sides" id="features" aria-labelledby="features-title">
        <div className="landing-section-heading" data-reveal>
          <p className="eyebrow">Для клиента и команды</p>
          <h2 id="features-title">Бронь в Telegram.<br />Управление в Slotty.</h2>
        </div>
        <div className="landing-side-grid">
          <article className="landing-side-card client-side-card" data-reveal="left">
            <div className="side-card-icon"><MessageCircleMore size={22} /></div>
            <p className="eyebrow">Для клиента</p>
            <h3>Выбрать время в Telegram Mini App</h3>
            <ul>
              <li><Check size={15} /> Услуги, специалисты и свободное время</li>
              <li><Check size={15} /> Отзывы и фото работ мастера</li>
              <li><Check size={15} /> Запись без звонка и регистрации</li>
            </ul>
            <Link to="/zapis-cherez-telegram">Как работает запись <ArrowRight size={15} /></Link>
          </article>
          <article className="landing-side-card business-side-card" data-reveal="right">
            <div className="side-card-icon"><CalendarCheck2 size={22} /></div>
            <p className="eyebrow">Для бизнеса</p>
            <h3>Держать расписание под контролем</h3>
            <ul>
              <li><Check size={15} /> Записи и команда в одной панели</li>
              <li><Check size={15} /> Напоминания и лист ожидания</li>
              <li><Check size={15} /> Выручка и загрузка сотрудников</li>
            </ul>
            <Link to="/online-zapis">Все возможности <ArrowRight size={15} /></Link>
          </article>
        </div>
      </section>

      <section className="landing-how" id="how" aria-labelledby="how-title">
        <div data-reveal="left"><p className="eyebrow">Быстрый старт</p><h2 id="how-title">Три шага до первой записи.</h2></div>
        <div className="landing-steps" data-reveal="right">{setupSteps.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <section className="landing-faq" aria-labelledby="home-faq-title">
        <div className="landing-section-heading" data-reveal="left"><p className="eyebrow">Вопросы</p><h2 id="home-faq-title">Коротко о главном</h2></div>
        <LandingFaq />
      </section>

      <section className="landing-final-cta" aria-labelledby="final-cta-title" data-reveal>
        <p className="eyebrow">Slotty для вашего бизнеса</p>
        <h2 id="final-cta-title">Запустите запись в Telegram.</h2>
        <p>14 дней бесплатно, без банковской карты.</p>
        <Link className="primary-button lime-button" to="/app?mode=register" onClick={() => { trackEvent('landing_start_trial', { source: 'home_final' }); trackEvent('registration_start', { source: 'home_final' }); }}>Создать рабочее пространство <ArrowRight size={17} /></Link>
      </section>
    </MarketingLayout>
  );
}

function BookingDemo() {
  const [serviceId, setServiceId] = useState<(typeof services)[number]['id']>('haircut');
  const [selectedTime, setSelectedTime] = useState<(typeof demoTimes)[number] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const service = services.find((item) => item.id === serviceId) ?? services[0];

  function chooseService(id: (typeof services)[number]['id']) {
    setServiceId(id);
    setSelectedTime(null);
    setConfirmed(false);
  }

  function resetDemo() {
    setServiceId('haircut');
    setSelectedTime(null);
    setConfirmed(false);
  }

  return (
    <section className="landing-demo" id="demo" aria-labelledby="demo-title">
      <div className="landing-section-heading demo-heading" data-reveal>
        <div><p className="eyebrow">Попробуйте сами</p><h2 id="demo-title">Выбор в Mini App.<br />Запись в календаре.</h2></div>
        <p>Демо показывает процесс, не создавая настоящую запись.</p>
      </div>
      <div className="demo-stage" data-reveal>
        <div className="demo-chat" aria-label="Демонстрация Telegram Mini App">
          <header><span className="demo-telegram-mark"><Send size={17} /></span><div><b>Slotty в Telegram</b><small>демо Mini App</small></div><i aria-hidden="true" /></header>
          <div className="demo-chat-body">
            <h3 className="demo-miniapp-title">Выберите услугу</h3>
            <div className="demo-options demo-services" aria-label="Выбор услуги">
              {services.map((item) => <button type="button" key={item.id} className={serviceId === item.id ? 'selected' : ''} aria-pressed={serviceId === item.id} onClick={() => chooseService(item.id)}><span>{item.name}</span><small>{item.duration} мин · {item.price}</small></button>)}
            </div>
            <p className="demo-miniapp-step">Свободное время · {service.employee}</p>
            <div className="demo-options demo-times" aria-label="Выбор времени">
              {demoTimes.map((time) => <button type="button" key={time} className={selectedTime === time ? 'selected' : ''} aria-pressed={selectedTime === time} onClick={() => { setSelectedTime(time); setConfirmed(false); }}>{time}</button>)}
            </div>
            <button type="button" className="demo-confirm" disabled={!selectedTime || confirmed} onClick={() => { setConfirmed(true); trackEvent('landing_demo_completed', { service: service.id }); }}>
              {confirmed ? <><CircleCheck size={17} /> Запись подтверждена</> : 'Подтвердить запись'}
            </button>
          </div>
        </div>

        <div className="demo-sync" aria-hidden="true"><span><ArrowRight size={15} /></span></div>

        <div className="demo-panel" aria-label="Демонстрация панели Slotty">
          <header><div><span className="landing-product-mark"><SlottyMark size={21} tone="dark" /></span><b>Slotty</b></div><span><i /> Синхронизировано</span></header>
          <div className="demo-panel-title"><div><p className="eyebrow">Сегодня</p><h3>Расписание</h3></div><button type="button" onClick={resetDemo} aria-label="Начать демонстрацию заново"><RotateCcw size={15} /> Заново</button></div>
          <div className="demo-schedule" aria-live="polite">
            <span>09:00</span><article><b>Анна Миронова</b><small>Окрашивание · Елена</small></article>
            {confirmed && selectedTime ? <><span className="demo-new-time">{selectedTime}</span><article className="demo-new-booking"><div><b>Новая запись</b><small>{service.name} · {service.employee} · {service.duration} мин</small></div><em>Telegram</em></article></> : <><span>12:30</span><article className="demo-empty-slot"><b>Свободный слот</b><small>Появится здесь после подтверждения</small></article></>}
            <span>16:30</span><article><b>Олег Волков</b><small>Консультация · Мария</small></article>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="landing-faq-list" data-reveal="right">
      {faqItems.map(([question, answer], index) => {
        const open = openIndex === index;
        const answerId = `home-faq-answer-${index}`;
        return <div className={`faq-item ${open ? 'open' : ''}`} key={question}>
          <button type="button" aria-expanded={open} aria-controls={answerId} onClick={() => setOpenIndex(open ? null : index)}><span aria-hidden="true">▶</span>{question}</button>
          <div className="faq-answer" aria-hidden={!open}><div><p id={answerId}>{answer}</p></div></div>
        </div>;
      })}
    </div>
  );
}
