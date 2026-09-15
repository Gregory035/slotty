import { ArrowRight, CalendarCheck, Clock3, LineChart, MessageCircleMore, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../analytics';
import { MarketingLayout } from './MarketingLayout';

const capabilities = [
  [CalendarCheck, 'Расписание без пересечений', 'Slotty показывает свободные интервалы с учётом длительности услуги, сотрудника и уже созданных записей.'],
  [UsersRound, 'Клиенты и команда', 'История визитов, заметки, роли сотрудников и доступ к нужным разделам собраны в одном рабочем пространстве.'],
  [MessageCircleMore, 'Напоминания и изменения', 'Клиент может подтвердить, перенести или отменить визит, а администратор увидит изменение в системе.'],
  [Clock3, 'Лист ожидания', 'Если подходящего времени нет, клиент оставляет заявку и получает предложение, когда слот освобождается.'],
  [LineChart, 'Понятная аналитика', 'Выручка, загрузка команды, отмены, неявки, популярные услуги и повторные визиты доступны владельцу.'],
] as const;

export function OnlineBookingPage() {
  return <MarketingLayout>
    <section className="marketing-hero"><nav className="breadcrumbs" aria-label="Хлебные крошки"><Link to="/">Главная</Link><span aria-hidden="true">/</span><span>Онлайн-запись</span></nav><p className="eyebrow">Система для бизнеса услуг</p><h1>Онлайн-запись клиентов без ручного согласования</h1><p>Slotty связывает услуги, сотрудников и рабочее расписание. Клиент выбирает доступное время, а новая запись сразу появляется в панели.</p><div className="landing-actions"><Link className="primary-button lime-button" to="/app?mode=register" onClick={() => { trackEvent('landing_start_trial', { source: 'online_booking' }); trackEvent('registration_start', { source: 'online_booking' }); }}>Начать бесплатно <ArrowRight size={17} /></Link><Link className="text-button" to="/zapis-cherez-telegram">Как работает Telegram-запись</Link></div><span className="landing-note">14 дней бесплатно · без карты</span></section>
    <section className="marketing-section" aria-labelledby="online-capabilities"><p className="eyebrow">В одном процессе</p><h2 id="online-capabilities">От свободного слота до повторного визита</h2><div className="capability-grid">{capabilities.map(([Icon, title, description]) => <article key={title}><Icon size={21} aria-hidden="true" /><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className="marketing-flow"><div><p className="eyebrow">Быстрый старт</p><h2>Настройте запись по шагам</h2></div><ol><li><span>01</span><div><h3>Добавьте услуги и сотрудников</h3><p>Укажите длительность, стоимость и исполнителей.</p></div></li><li><span>02</span><div><h3>Опубликуйте расписание</h3><p>Slotty рассчитает доступное время без пересечений.</p></div></li><li><span>03</span><div><h3>Принимайте записи</h3><p>Следите за визитами, изменениями и результатами в панели.</p></div></li></ol></section>
    <FaqSection />
  </MarketingLayout>;
}

function FaqSection() {
  return <section className="marketing-faq" aria-labelledby="online-faq"><p className="eyebrow">Вопросы</p><h2 id="online-faq">Что важно знать</h2><div><details><summary>Нужно ли клиенту устанавливать отдельное приложение?</summary><p>Нет. Для записи через подключённого бота клиенту достаточно Telegram.</p></details><details><summary>Slotty учитывает длительность услуги?</summary><p>Да. Начало записи доступно только тогда, когда весь интервал услуги свободен у выбранного сотрудника.</p></details><details><summary>Что происходит при отмене?</summary><p>Статус записи меняется в панели, а освободившееся время может быть предложено первому клиенту из листа ожидания.</p></details><details><summary>Можно ли собирать отзывы?</summary><p>После завершённого визита Slotty может запросить оценку у клиента через Telegram.</p></details></div></section>;
}
