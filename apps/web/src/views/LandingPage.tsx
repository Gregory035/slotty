import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowRight, BarChart3, BellRing, CalendarCheck2, CalendarDays, Check, ChevronRight,
  CircleCheck, Clock3, ListRestart, MessageCircleMore, RotateCcw, Send, Star, UsersRound,
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
  ['01', 'Создайте рабочее пространство', 'Укажите название компании и часовой пояс.'],
  ['02', 'Добавьте услуги и команду', 'Настройте длительность, стоимость и исполнителей.'],
  ['03', 'Опубликуйте расписание', 'Slotty рассчитает доступные интервалы без пересечений.'],
  ['04', 'Подключите Telegram-бота', 'Клиенты смогут записываться самостоятельно в знакомом чате.'],
] as const;

const faqItems = [
  ['Нужно ли клиенту регистрироваться в Slotty?', 'Нет. Клиент взаимодействует с Telegram-ботом компании. Отдельная учётная запись в панели ему не нужна.'],
  ['Как Slotty определяет свободное время?', 'Сервис учитывает рабочее расписание сотрудника, длительность услуги и уже созданные записи. Если услуга занимает час, весь этот интервал исключается из доступных слотов.'],
  ['Можно ли работать командой?', 'Да. В рабочее пространство можно добавить участников, назначить роли и связать сотрудников с услугами и расписанием.'],
  ['Что входит в пробный период?', 'После создания компании начинается 14-дневный пробный период. Для старта не требуется банковская карта.'],
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
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
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
        <span className="landing-hero-mark" aria-hidden="true"><SlottyMark size={44} /></span>
        <p className="eyebrow">Онлайн-запись для бизнеса услуг</p>
        <h1>Slotty</h1>
        <p className="landing-hero-tagline">Клиент записывается через Telegram.<br />Вы управляете расписанием в одной панели.</p>
        <p className="landing-hero-copy">Услуги, специалисты, свободные слоты и история клиентов синхронизируются автоматически — без ручного согласования времени.</p>
        <div className="landing-actions">
          <Link className="primary-button lime-button" to="/app?mode=register" onClick={() => { trackEvent('landing_start_trial'); trackEvent('registration_start', { source: 'home' }); }}>Начать бесплатно <ArrowRight size={17} /></Link>
          <a className="text-button" href="#demo" onClick={() => trackEvent('landing_view_demo')}>Попробовать демо <ChevronRight size={15} /></a>
        </div>
        <span className="landing-note">14 дней бесплатно · без карты</span>
      </section>

      <BookingDemo />

      <section className="landing-proof" aria-label="Что синхронизирует Slotty" data-reveal>
        <span><CalendarDays size={19} /> Записи сразу в календаре</span>
        <span><Send size={19} /> Telegram связан с расписанием</span>
        <span><UsersRound size={19} /> Команда работает в одной панели</span>
      </section>

      <section className="landing-audience" aria-labelledby="audience-title">
        <div className="landing-section-heading" data-reveal>
          <p className="eyebrow">Кому подходит</p>
          <h2 id="audience-title">Тем, кто работает по времени, а не в очереди.</h2>
          <p>Slotty подходит самостоятельным специалистам и командам, которым важно видеть свободные часы, загрузку сотрудников и историю каждого клиента.</p>
        </div>
        <div className="audience-list" role="list" data-reveal="right">
          <article role="listitem"><span>01</span><div><h3>Салоны и студии</h3><p>Несколько специалистов, разные услуги и единое расписание.</p></div></article>
          <article role="listitem"><span>02</span><div><h3>Частные специалисты</h3><p>Самостоятельная запись клиентов без постоянных сообщений.</p></div></article>
          <article role="listitem"><span>03</span><div><h3>Сервисные команды</h3><p>Роли, доступ к нужным разделам и контроль изменений.</p></div></article>
        </div>
      </section>

      <section className="landing-sides" id="features" aria-labelledby="features-title">
        <div className="landing-section-heading" data-reveal>
          <p className="eyebrow">Один процесс, две стороны</p>
          <h2 id="features-title">Клиенту — простой чат.<br />Бизнесу — полная картина.</h2>
        </div>
        <div className="landing-side-grid">
          <article className="landing-side-card client-side-card" data-reveal="left">
            <div className="side-card-icon"><MessageCircleMore size={22} /></div>
            <p className="eyebrow">Для клиента</p>
            <h3>Записаться без звонка и нового приложения</h3>
            <ul>
              <li><Check size={15} /> Выбрать услугу и специалиста</li>
              <li><Check size={15} /> Увидеть только свободное время</li>
              <li><Check size={15} /> Подтвердить, перенести или отменить визит</li>
              <li><Check size={15} /> Повторить прошлую запись и оставить отзыв</li>
            </ul>
            <Link to="/zapis-cherez-telegram">Подробнее о записи через Telegram <ArrowRight size={15} /></Link>
          </article>
          <article className="landing-side-card business-side-card" data-reveal="right">
            <div className="side-card-icon"><CalendarCheck2 size={22} /></div>
            <p className="eyebrow">Для бизнеса</p>
            <h3>Управлять визитами из единой панели</h3>
            <ul>
              <li><Check size={15} /> Расписание, услуги и сотрудники</li>
              <li><Check size={15} /> Клиентская база и история посещений</li>
              <li><Check size={15} /> Статусы, напоминания и лист ожидания</li>
              <li><Check size={15} /> Выручка, загрузка, отмены и неявки</li>
            </ul>
            <Link to="/online-zapis">Все возможности онлайн-записи <ArrowRight size={15} /></Link>
          </article>
        </div>
      </section>

      <section className="landing-operations" aria-labelledby="operations-title">
        <div className="landing-section-heading" data-reveal>
          <p className="eyebrow">После создания записи</p>
          <h2 id="operations-title">Slotty продолжает работу вместе с вами.</h2>
        </div>
        <div className="operations-grid" data-reveal>
          <article><BellRing size={21} /><span>01</span><h3>Напоминает о визите</h3><p>Клиент получает сообщение и может заранее подтвердить свои планы.</p></article>
          <article><ListRestart size={21} /><span>02</span><h3>Заполняет освободившееся время</h3><p>После отмены подходящий слот можно предложить клиенту из листа ожидания.</p></article>
          <article><Star size={21} /><span>03</span><h3>Собирает обратную связь</h3><p>После завершённой услуги клиент может поставить оценку через Telegram.</p></article>
          <article><BarChart3 size={21} /><span>04</span><h3>Показывает результат</h3><p>Владелец видит выручку, загрузку, популярные услуги и повторные визиты.</p></article>
        </div>
      </section>

      <section className="landing-how" id="how" aria-labelledby="how-title">
        <div data-reveal="left"><p className="eyebrow">Быстрый старт</p><h2 id="how-title">От регистрации до первой записи.</h2><p className="landing-section-copy">Онбординг ведёт по основным настройкам. Каждый шаг можно завершить в рабочей панели Slotty.</p></div>
        <div className="landing-steps" data-reveal="right">{setupSteps.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <section className="landing-security" id="security" data-reveal>
        <div><span className="security-check"><Check size={18} /></span><p className="eyebrow">Данные под контролем</p><h2>Понятные права<br />и история действий.</h2></div>
        <p>Владелец назначает роли, сотрудники видят нужные разделы, а важные изменения сохраняются в журнале. Токен Telegram-бота хранится в зашифрованном виде.</p>
      </section>

      <section className="landing-faq" aria-labelledby="home-faq-title">
        <div className="landing-section-heading" data-reveal="left"><p className="eyebrow">Вопросы</p><h2 id="home-faq-title">Перед началом работы</h2></div>
        <LandingFaq />
      </section>

      <section className="landing-final-cta" aria-labelledby="final-cta-title" data-reveal>
        <p className="eyebrow">Первая запись ближе, чем кажется</p>
        <h2 id="final-cta-title">Освободите переписку.<br />Соберите расписание.</h2>
        <p>Настройте услуги, команду и Telegram-бота — Slotty покажет клиентам свободное время и сохранит каждую запись в панели.</p>
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
        <div><p className="eyebrow">Интерактивная демонстрация</p><h2 id="demo-title">От сообщения до записи в расписании</h2></div>
        <p>Пройдите короткий путь клиента. Это локальное демо: оно не отправляет сообщения и не создаёт настоящую запись.</p>
      </div>
      <div className="demo-stage" data-reveal>
        <div className="demo-chat" aria-label="Демонстрация Telegram-бота">
          <header><span className="demo-telegram-mark"><Send size={17} /></span><div><b>Slotty Demo</b><small>демонстрационный бот</small></div><i aria-hidden="true" /></header>
          <div className="demo-chat-body">
            <div className="demo-bubble">Здравствуйте! Выберите услугу:</div>
            <div className="demo-options demo-services" aria-label="Выбор услуги">
              {services.map((item) => <button type="button" key={item.id} className={serviceId === item.id ? 'selected' : ''} aria-pressed={serviceId === item.id} onClick={() => chooseService(item.id)}><span>{item.name}</span><small>{item.duration} мин · {item.price}</small></button>)}
            </div>
            <div className="demo-bubble">Свободное время у специалиста {service.employee}:</div>
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
          <header><div><span className="landing-product-mark"><SlottyMark size={21} /></span><b>Slotty</b></div><span><i /> Синхронизировано</span></header>
          <div className="demo-panel-title"><div><p className="eyebrow">Сегодня</p><h3>Расписание</h3></div><button type="button" onClick={resetDemo} aria-label="Начать демонстрацию заново"><RotateCcw size={15} /> Заново</button></div>
          <div className="demo-schedule" aria-live="polite">
            <span>09:00</span><article><b>Анна Миронова</b><small>Окрашивание · Елена</small></article>
            {confirmed && selectedTime ? <><span className="demo-new-time">{selectedTime}</span><article className="demo-new-booking"><div><b>Новая запись</b><small>{service.name} · {service.employee} · {service.duration} мин</small></div><em>Telegram</em></article></> : <><span>12:30</span><article className="demo-empty-slot"><b>Свободный слот</b><small>Появится здесь после подтверждения</small></article></>}
            <span>16:30</span><article><b>Олег Волков</b><small>Консультация · Мария</small></article>
          </div>
        </div>
      </div>
      <div className="demo-caption" data-reveal><Clock3 size={16} /><p><b>Slotty проверяет весь интервал услуги.</b> После часовой записи следующие занятые слоты исчезают из выбора клиента.</p></div>
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
