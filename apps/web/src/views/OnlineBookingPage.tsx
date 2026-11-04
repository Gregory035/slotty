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
    <section className="marketing-hero"><nav className="breadcrumbs" aria-label="Хлебные крошки"><Link to="/">Главная</Link><span aria-hidden="true">/</span><span>Онлайн-запись</span></nav><p className="eyebrow">Система для бизнеса услуг</p><h1>Онлайн-запись клиентов без ручного согласования</h1><p>Slotty связывает услуги, сотрудников и рабочее расписание. Клиент выбирает доступное время, а новая запись сразу появляется в панели.</p><div className="landing-actions"><Link className="primary-button lime-button" to="/app?mode=register" onClick={() => { trackEvent('landing_start_trial', { source: 'online_booking' }); }}>Начать бесплатно <ArrowRight size={17} /></Link><Link className="text-button" to="/zapis-cherez-telegram">Как работает Telegram-запись</Link></div><span className="landing-note">14 дней бесплатно · без карты</span></section>
    <section className="marketing-section" aria-labelledby="online-capabilities"><p className="eyebrow">В одном процессе</p><h2 id="online-capabilities">От свободного слота до повторного визита</h2><div className="capability-grid">{capabilities.map(([Icon, title, description]) => <article key={title}><Icon size={21} aria-hidden="true" /><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className="marketing-flow"><div><p className="eyebrow">Быстрый старт</p><h2>Настройте запись по шагам</h2></div><ol><li><span>01</span><div><h3>Добавьте услуги и сотрудников</h3><p>Укажите длительность, стоимость и исполнителей.</p></div></li><li><span>02</span><div><h3>Опубликуйте расписание</h3><p>Slotty рассчитает доступное время без пересечений.</p></div></li><li><span>03</span><div><h3>Принимайте записи</h3><p>Следите за визитами, изменениями и результатами в панели.</p></div></li></ol></section>
    <section className="marketing-section" aria-labelledby="online-for-whom"><p className="eyebrow">Для разных форматов работы</p><h2 id="online-for-whom">Настройте Slotty под себя или команду</h2><div className="capability-grid"><article><UsersRound size={21} aria-hidden="true" /><h3>Частному мастеру</h3><p>Личное расписание, услуги, история клиентов, отзывы и фотографии работ.</p><Link className="marketing-card-link" to="/dlya-mastera">Онлайн-запись для мастера <ArrowRight size={15} /></Link></article><article><CalendarCheck size={21} aria-hidden="true" /><h3>Салону или студии</h3><p>Общий календарь, отдельные графики сотрудников, роли и аналитика команды.</p><Link className="marketing-card-link" to="/dlya-salona">Онлайн-запись для салона <ArrowRight size={15} /></Link></article><article><MessageCircleMore size={21} aria-hidden="true" /><h3>Через Telegram</h3><p>Mini App без отдельного приложения и ручного согласования свободного времени.</p><Link className="marketing-card-link" to="/zapis-cherez-telegram">Запись через Telegram <ArrowRight size={15} /></Link></article></div></section>
    <section className="marketing-flow" aria-labelledby="online-slot-example">
      <div>
        <p className="eyebrow">На конкретном примере</p>
        <h2 id="online-slot-example">Как Slotty определяет свободное время</h2>
        <p className="marketing-flow-copy">Допустим, услуга длится час, а у специалиста уже есть визит с 14:00 до 15:00. Для новой записи нужен целый свободный час, а не только свободное время начала.</p>
      </div>
      <ol>
        <li><span>01</span><div><h3>Проверяет весь интервал</h3><p>Начало в 13:30 не подойдёт: услуга закончилась бы в 14:30 и пересеклась с существующей записью. Также учитываются рабочие часы выбранного сотрудника.</p></div></li>
        <li><span>02</span><div><h3>Обновляет расписание при переносе</h3><p>Для нового времени снова проверяется доступность. После переноса в календаре остаётся актуальное время визита.</p></div></li>
        <li><span>03</span><div><h3>Освобождает время при отмене</h3><p>Отменённый визит больше не занимает интервал. При наличии подходящей заявки Slotty может предложить его клиенту из листа ожидания.</p></div></li>
      </ol>
    </section>
    <FaqSection />
  </MarketingLayout>;
}

function FaqSection() {
  return <section className="marketing-faq" aria-labelledby="online-faq"><p className="eyebrow">Вопросы</p><h2 id="online-faq">Что настроить перед первой записью</h2><div><details><summary>Что нужно добавить, чтобы появились свободные слоты?</summary><p>Создайте услуги с длительностью, назначьте исполнителей и задайте их рабочие часы. Для самостоятельной записи клиентов подключите Telegram-бота: Mini App использует то же расписание, что и панель.</p></details><details><summary>Если я работаю один, мне нужна команда?</summary><p>Нет. Можно быть владельцем и самому оказывать услуги. Для личного расписания используйте режим самостоятельного специалиста. <Link to="/dlya-mastera">Подробнее о работе мастера</Link>.</p></details><details><summary>Можно ли записать клиента вручную?</summary><p>Да. Администратор может создать запись в панели, например после звонка клиента. Она займёт время в общем расписании — этот интервал не будет предлагаться для самостоятельной записи через Telegram.</p></details><details><summary>Можно ли собрать несколько услуг в один визит?</summary><p>Да. Клиент может выбрать несколько услуг и разных специалистов. Доступность подбирается с учётом каждого исполнителя. <Link to="/zapis-cherez-telegram">Посмотреть сценарий в Telegram</Link>.</p></details></div></section>;
}
