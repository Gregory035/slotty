import { ArrowRight, CalendarCheck, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../analytics';
import { MarketingLayout } from './MarketingLayout';

const setupSteps = [
  ['Создайте бота', 'Откройте @BotFather в Telegram, создайте бота и получите токен. Не отправляйте токен клиентам и не публикуйте его.'],
  ['Подключите бота к Slotty', 'В рабочем пространстве откройте раздел «Telegram-бот» и вставьте токен. Убедитесь, что бот активен.'],
  ['Настройте услуги и рабочие часы', 'Добавьте услуги с длительностью, назначьте их специалистам и задайте расписание. Если работаете один, используйте свой профиль мастера.'],
  ['Проверьте свободное время', 'На экране обзора выберите дату и нажмите «Проверить запись». Проверка показывает доступное время, но не создаёт визит.'],
  ['Отправьте ссылку клиентам', 'Скопируйте ссылку на бота из панели. Клиент открывает её в Telegram и нажимает «Записаться», чтобы перейти в Mini App.'],
] as const;

export function TelegramBookingPage() {
  return <MarketingLayout>
    <section className="marketing-hero">
      <nav className="breadcrumbs" aria-label="Хлебные крошки"><Link to="/">Главная</Link><span aria-hidden="true">/</span><span>Запись через Telegram</span></nav>
      <p className="eyebrow">Telegram Mini App для записи</p>
      <h1>Онлайн-запись клиентов через Телеграм</h1>
      <p>Клиент выбирает услугу, специалиста и время прямо в Telegram. Вы получаете визит в расписании Slotty без ручного переноса из переписки.</p>
      <div className="landing-actions">
        <Link className="primary-button lime-button" to="/app?mode=register" onClick={() => { trackEvent('landing_start_trial', { source: 'telegram_booking' }); }}>Подключить Slotty <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </section>
    <section className="marketing-flow" aria-labelledby="telegram-setup-title">
      <div><p className="eyebrow">Настройка</p><h2 id="telegram-setup-title">Как запустить запись через Telegram</h2><p className="marketing-flow-copy">Пять шагов от своего бота до ссылки, по которой клиенты смогут записаться.</p></div>
      <ol>{setupSteps.map(([title, description], index) => <li key={title}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
    </section>
    <section className="marketing-section" aria-labelledby="telegram-booking-example">
      <p className="eyebrow">Пример записи</p>
      <h2 id="telegram-booking-example">Что увидит клиент, а что – владелец</h2>
      <div className="capability-grid">
        <article><Send size={21} aria-hidden="true" /><h3>В Mini App</h3><p>Например, клиент выбирает стрижку, смотрит фото работ мастера, если они опубликованы, и бронирует один из свободных интервалов. Для записи не нужен аккаунт Slotty.</p></article>
        <article><CalendarCheck size={21} aria-hidden="true" /><h3>В панели Slotty</h3><p>В расписании появляются время, услуга, специалист и статус визита. Занятое время больше не предлагается клиентам. При переносе или отмене расписание обновляется.</p></article>
      </div>
      <div className="landing-actions"><Link className="text-button" to="/dlya-mastera">Сценарий для частного мастера</Link><Link className="text-button" to="/dlya-salona">Сценарий для салона и команды</Link><Link className="text-button" to="/online-zapis">Все возможности онлайн-записи</Link></div>
    </section>
    <section className="marketing-faq" aria-labelledby="telegram-faq">
      <p className="eyebrow">Вопросы</p><h2 id="telegram-faq">Перед первой записью</h2>
      <div>
        <details><summary>Что делать, если Mini App не показывает свободное время?</summary><p>Проверьте, что услуга назначена активному специалисту, у него есть рабочие часы на выбранную дату, а свободный интервал не короче услуги.</p></details>
        <details><summary>Можно ли записаться на несколько услуг за один визит?</summary><p>Да. В Mini App можно добавить несколько услуг. Если работаете командой, услуги могут выполнять разные специалисты. Время внутри одного визита должно идти по порядку.</p></details>
        <details><summary>Можно ли перенести или отменить запись?</summary><p>Клиент может открыть свои записи в Telegram и перенести или отменить визит по правилам компании.</p></details>
      </div>
    </section>
  </MarketingLayout>;
}
