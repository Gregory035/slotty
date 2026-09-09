import { ArrowRight, CalendarDays, Check, Command, Menu, Send, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand, SlottyMark } from '../components/Brand';
import { trackEvent } from '../analytics';

const steps = [
  ['01', 'Создайте услуги', 'Длительность, цена и команда в одном месте.'],
  ['02', 'Настройте расписание', 'Свободные часы и правила записи.'],
  ['03', 'Подключите Telegram', 'Клиент запишется без переписки.'],
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="brand-home" to="/" aria-label="Slotty — главная"><Brand /></Link>
        <div className="landing-links"><a href="#product">Продукт</a><a href="#how">Как работает</a><a href="#security">Безопасность</a></div>
        <Link className="secondary-button landing-login" to="/app">Войти</Link>
      </header>
      <section className="landing-hero">
        <p className="eyebrow">Онлайн-запись для малого бизнеса</p>
        <h1>Запись клиентов<br />через Telegram.</h1>
        <p>Slotty собирает запись, клиентов, команду и расписание в одну рабочую систему — без переписки и ручного согласования времени.</p>
        <div className="landing-actions"><Link className="primary-button lime-button" to="/app" onClick={() => trackEvent('landing_start_trial')}>Начать бесплатно <ArrowRight size={17} /></Link><a className="text-button" href="#product" onClick={() => trackEvent('landing_view_product')}>Посмотреть интерфейс</a></div>
        <span className="landing-note">14 дней бесплатно · без карты</span>
      </section>
      <section className="landing-product" id="product" aria-label="Интерфейс Slotty">
        <aside><span className="landing-product-mark"><SlottyMark size={25} /></span><span>Slotty</span><button className="landing-active">Обзор</button><button>Календарь</button><button>Записи</button><button>Клиенты</button><button>Telegram</button></aside>
        <div className="landing-canvas">
          <header><span>Сегодня, 8 августа</span><div><Command size={14} /> Поиск <kbd>⌘ K</kbd></div></header>
          <div className="landing-calendar-header"><div><p className="eyebrow">Ваш день</p><h2>Спокойный темп</h2></div><button className="primary-button lime-button">Новая запись</button></div>
          <div className="landing-timeline">
            <span>10:00</span><article><b>Анна Миронова</b><small>Стрижка · Елена</small></article>
            <span>12:30</span><article className="landing-timeline-dark"><b>Дмитрий Соколов</b><small>Маникюр · Мария</small></article>
            <span>15:00</span><article><b>Свободный слот</b><small>Доступен в Telegram</small></article>
          </div>
        </div>
      </section>
      <section className="landing-proof"><span><CalendarDays size={19} /> Все записи в календаре</span><span><Send size={19} /> Telegram синхронизирован</span><span><UsersRound size={19} /> Команда видит своё</span></section>
      <section className="landing-how" id="how"><div><p className="eyebrow">От первого дня к системе</p><h2>Никакого обучения на неделю.</h2></div><div className="landing-steps">{steps.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
      <section className="landing-security" id="security"><div><span className="security-check"><Check size={18} /></span><p className="eyebrow">Данные под контролем</p><h2>Рабочая система,<br />которой можно доверять.</h2></div><p>Права доступа, журнал действий и защищённый webhook для Telegram — без лишней сложности.</p></section>
      <section className="landing-seo-copy" aria-labelledby="landing-seo-title"><p className="eyebrow">Для бизнеса услуг</p><h2 id="landing-seo-title">Онлайн-запись, которая не теряет клиентов</h2><p>Клиент выбирает услугу и свободное время в Telegram, а Slotty сразу фиксирует запись в расписании. Владельцу доступны команда, база клиентов, история визитов и аналитика.</p></section>
      <footer className="landing-footer"><Link className="brand-home" to="/" aria-label="Slotty — главная"><Brand /></Link><span>© {new Date().getFullYear()} Slotty</span><Link to="/app" onClick={() => trackEvent('landing_login')}>Войти в панель</Link></footer>
    </main>
  );
}
