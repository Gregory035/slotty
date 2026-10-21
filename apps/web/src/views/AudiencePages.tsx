import {
  ArrowRight, BarChart3, BellRing, CalendarCheck2, Camera, Clock3,
  MessageCircleMore, ShieldCheck, Star, UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../analytics';
import { MarketingLayout } from './MarketingLayout';

export function MasterBookingPage() {
  return <MarketingLayout>
    <section className="marketing-hero">
      <Breadcrumb current="Для мастера" />
      <p className="eyebrow">Slotty для частного специалиста</p>
      <h1>Онлайн‑запись клиентов для частного мастера</h1>
      <p>Клиент выбирает услугу и свободное время в Telegram Mini App. Вы получаете готовую запись и управляете рабочим днём без переписки о времени.</p>
      <Actions source="master" secondaryHref="/zapis-cherez-telegram" secondaryLabel="Посмотреть Telegram-запись" />
    </section>

    <section className="marketing-section" aria-labelledby="master-tasks">
      <p className="eyebrow">Вместо таблиц и переписки</p>
      <h2 id="master-tasks">Расписание, клиенты и ваши работы — в одном месте</h2>
      <div className="capability-grid">
        <article><CalendarCheck2 size={21} aria-hidden="true" /><h3>Свободное время без накладок</h3><p>Slotty учитывает рабочие часы, длительность услуги и уже созданные записи. Занятый интервал не показывается клиенту.</p></article>
        <article><MessageCircleMore size={21} aria-hidden="true" /><h3>Запись прямо в Telegram</h3><p>Клиенту не нужна отдельная учётная запись или новое приложение. Он выбирает время в Mini App вашего бота.</p></article>
        <article><BellRing size={21} aria-hidden="true" /><h3>Напоминания о визите</h3><p>Клиент получает сообщение перед записью и может подтвердить, перенести или отменить визит.</p></article>
        <article><Camera size={21} aria-hidden="true" /><h3>Примеры работ</h3><p>В профиле специалиста можно показать фотографии выполненных работ, чтобы клиенту было проще выбрать мастера.</p></article>
        <article><Star size={21} aria-hidden="true" /><h3>Отзывы после услуги</h3><p>После завершённого визита клиент может оценить услугу. Отзывы помогают сформировать доверие до записи.</p></article>
        <article><Clock3 size={21} aria-hidden="true" /><h3>История клиентов</h3><p>Прошлые и будущие визиты, заметки и повторные записи остаются в рабочей панели.</p></article>
      </div>
    </section>

    <section className="marketing-flow">
      <div><p className="eyebrow">Запуск без сложной настройки</p><h2>Начните принимать записи за три шага</h2></div>
      <ol>
        <li><span>01</span><div><h3>Создайте услуги</h3><p>Добавьте название, продолжительность, цену и рабочие часы.</p></div></li>
        <li><span>02</span><div><h3>Подключите Telegram-бота</h3><p>Клиенты увидят услуги и доступное время в вашем Mini App.</p></div></li>
        <li><span>03</span><div><h3>Поделитесь ботом</h3><p>Добавьте ссылку в социальные сети и принимайте записи в расписание Slotty.</p></div></li>
      </ol>
    </section>

    <AudienceFaq type="master" />
  </MarketingLayout>;
}

export function SalonBookingPage() {
  return <MarketingLayout>
    <section className="marketing-hero">
      <Breadcrumb current="Для салона и студии" />
      <p className="eyebrow">Slotty для команды</p>
      <h1>Система онлайн‑записи для салона и студии</h1>
      <p>Общее расписание, отдельные графики сотрудников и запись через Telegram. Администратор видит изменения, а владелец — загрузку команды и выручку.</p>
      <Actions source="salon" secondaryHref="/online-zapis" secondaryLabel="Все возможности Slotty" />
    </section>

    <section className="marketing-section" aria-labelledby="salon-tasks">
      <p className="eyebrow">Для команды и администратора</p>
      <h2 id="salon-tasks">Управляйте записями разных специалистов без путаницы</h2>
      <div className="capability-grid">
        <article><UsersRound size={21} aria-hidden="true" /><h3>Расписание сотрудников</h3><p>У каждого специалиста свой график, услуги и занятые интервалы. Все записи доступны в общем календаре.</p></article>
        <article><CalendarCheck2 size={21} aria-hidden="true" /><h3>Несколько услуг за визит</h3><p>Клиент может выбрать несколько услуг и разных специалистов. Slotty подбирает совместимое свободное время.</p></article>
        <article><ShieldCheck size={21} aria-hidden="true" /><h3>Роли и доступ</h3><p>Владелец управляет участниками рабочего пространства и определяет, кому доступны разделы компании.</p></article>
        <article><BarChart3 size={21} aria-hidden="true" /><h3>Загрузка и выручка</h3><p>Аналитика показывает загрузку сотрудников, популярные услуги, отмены, неявки и повторные визиты.</p></article>
        <article><BellRing size={21} aria-hidden="true" /><h3>Напоминания и статусы</h3><p>Подтверждения, переносы и отмены синхронизируются между клиентом и рабочей панелью.</p></article>
        <article><Clock3 size={21} aria-hidden="true" /><h3>Лист ожидания</h3><p>Если подходящего времени нет, клиент оставляет заявку. Освободившийся слот можно предложить ожидающему клиенту.</p></article>
      </div>
    </section>

    <section className="marketing-flow">
      <div><p className="eyebrow">Единый процесс</p><h2>От настройки команды до первой записи</h2></div>
      <ol>
        <li><span>01</span><div><h3>Добавьте сотрудников и услуги</h3><p>Свяжите специалистов с услугами и настройте их рабочие часы.</p></div></li>
        <li><span>02</span><div><h3>Подключите Telegram</h3><p>Клиент выберет услугу, специалиста и доступное время в Mini App.</p></div></li>
        <li><span>03</span><div><h3>Работайте с общим расписанием</h3><p>Команда видит записи, изменения и статусы в одном рабочем пространстве.</p></div></li>
      </ol>
    </section>

    <AudienceFaq type="salon" />
  </MarketingLayout>;
}

function Breadcrumb({ current }: { current: string }) {
  return <nav className="breadcrumbs" aria-label="Хлебные крошки"><Link to="/">Главная</Link><span aria-hidden="true">/</span><span>{current}</span></nav>;
}

function Actions({ source, secondaryHref, secondaryLabel }: { source: string; secondaryHref: string; secondaryLabel: string }) {
  return <><div className="landing-actions"><Link className="primary-button lime-button" to="/app?mode=register" onClick={() => { trackEvent('landing_start_trial', { source }); trackEvent('registration_start', { source }); }}>Начать бесплатно <ArrowRight size={17} /></Link><Link className="text-button" to={secondaryHref}>{secondaryLabel}</Link></div><span className="landing-note">14 дней бесплатно · без карты</span></>;
}

function AudienceFaq({ type }: { type: 'master' | 'salon' }) {
  return <section className="marketing-faq" aria-labelledby={`${type}-faq`}>
    <p className="eyebrow">Вопросы</p>
    <h2 id={`${type}-faq`}>{type === 'master' ? 'Онлайн‑запись для мастера' : 'Онлайн‑запись для команды'}</h2>
    <div>
      {type === 'master' ? <>
        <details><summary>Подойдёт ли Slotty одному специалисту?</summary><p>Да. Можно добавить свои услуги, расписание и принимать записи через Telegram без отдельного администратора.</p></details>
        <details><summary>Клиенту нужно устанавливать приложение?</summary><p>Нет. Mini App открывается внутри Telegram, а отдельная регистрация клиента в Slotty не требуется.</p></details>
        <details><summary>Можно ли изменить рабочие часы?</summary><p>Да. Доступные клиенту слоты рассчитываются по актуальному расписанию и уже созданным записям.</p></details>
      </> : <>
        <details><summary>Можно ли настроить отдельный график каждому сотруднику?</summary><p>Да. Доступность рассчитывается отдельно для каждого специалиста с учётом его услуг, рабочего времени и записей.</p></details>
        <details><summary>Можно ли работать с разными ролями?</summary><p>Да. Владелец добавляет участников в рабочее пространство и назначает им доступную роль.</p></details>
        <details><summary>Что увидит администратор после записи клиента?</summary><p>В панели появятся время, услуги, специалисты и статус визита. Изменения клиента также отражаются в расписании.</p></details>
      </>}
    </div>
  </section>;
}
