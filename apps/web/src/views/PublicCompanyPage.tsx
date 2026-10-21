import { useEffect, useMemo, useState } from 'react';
import { Clock3, MapPin, MessageCircle, Star } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getPublicCompany, getWorkExampleImageUrl } from '../api';
import { Brand } from '../components/Brand';
import type { PublicCompany } from '../types';
import { errorMessage, formatMoney } from '../utils';

export function PublicCompanyPage() {
  const { slug = '' } = useParams();
  const [company, setCompany] = useState<PublicCompany | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void getPublicCompany(slug).then((result) => {
      if (!active) return;
      setCompany(result);
      document.title = `${result.name} — онлайн-запись в Slotty`;
      const description = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
      description?.setAttribute('content', result.description || `Услуги, специалисты и онлайн-запись компании ${result.name}.`);
    }).catch((caught) => active && setError(errorMessage(caught)));
    return () => { active = false; };
  }, [slug]);
  const employees = useMemo(() => {
    const map = new Map<string, PublicCompany['services'][number]['employees'][number]>();
    company?.services.forEach((service) => service.employees.forEach((employee) => map.set(employee.id, employee)));
    return [...map.values()];
  }, [company]);
  if (error) return <PublicState title="Страница недоступна" description="Компания отключила публичную страницу или адрес изменился." />;
  if (!company) return <PublicState title="Открываем страницу" description="Загружаем услуги и специалистов…" />;
  const telegramUrl = company.botUsername ? `https://t.me/${company.botUsername.replace(/^@/, '')}?start=book` : null;
  return <div className="public-company-page">
    <header><Link to="/" aria-label="Slotty — главная"><Brand /></Link><span>Страница компании в Slotty</span></header>
    <main>
      <section className="public-company-hero">
        <div>{company.logoUrl ? <img src={company.logoUrl} alt="" /> : <span>{company.name.slice(0, 2).toUpperCase()}</span>}</div>
        <article><p>Онлайн-запись</p><h1>{company.name}</h1>{company.description && <p>{company.description}</p>}<ul>{company.address && <li><MapPin size={16} />{company.address}</li>}{company.phone && <li>{company.phone}</li>}</ul>{telegramUrl && <a className="primary-button lime-button" href={telegramUrl} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Записаться в Telegram</a>}</article>
      </section>
      <section className="public-company-section"><div className="public-section-title"><p>Услуги</p><h2>Что можно выбрать</h2></div><div className="public-service-grid">{company.services.map((service) => <article key={service.id}><span>{service.category || 'Услуга'}</span><h3>{service.name}</h3>{service.description && <p>{service.description}</p>}<footer><span><Clock3 size={15} />{service.durationMinutes} мин</span><strong>{formatMoney(service.price, company.currency)}</strong></footer></article>)}</div></section>
      {employees.length > 0 && <section className="public-company-section"><div className="public-section-title"><p>Команда</p><h2>Специалисты и работы</h2></div><div className="public-employee-list">{employees.map((employee) => <article key={employee.id}><div className="public-employee-head">{employee.photoUrl ? <img src={employee.photoUrl} alt="" /> : <span>{employee.name.slice(0, 1)}</span>}<div><h3>{employee.name}</h3>{employee.rating > 0 && <p><Star size={14} fill="currentColor" /> {employee.rating} · {employee.reviews.length} отзывов</p>}</div></div>{employee.description && <p>{employee.description}</p>}{employee.workExamples.length > 0 && <div className="public-work-carousel">{employee.workExamples.map((work) => <figure key={work.id}><img loading="lazy" src={getWorkExampleImageUrl(work.id, true)} alt={work.caption || `Работа специалиста ${employee.name}`} />{work.caption && <figcaption>{work.caption}</figcaption>}</figure>)}</div>}{employee.reviews.some((review) => review.comment) && <div className="public-review-list">{employee.reviews.filter((review) => review.comment).slice(0, 3).map((review, index) => <blockquote key={`${review.createdAt}-${index}`}><span>{'★'.repeat(review.rating)}</span><p>{review.comment}</p><cite>{review.customerName}</cite></blockquote>)}</div>}</article>)}</div></section>}
    </main>
    <footer><Brand /><span>Онлайн-запись работает на Slotty</span><Link to="/privacy">Конфиденциальность</Link></footer>
  </div>;
}

function PublicState({ title, description }: { title: string; description: string }) {
  return <div className="public-company-state"><Brand /><h1>{title}</h1><p>{description}</p><Link className="secondary-button" to="/">На главную Slotty</Link></div>;
}
