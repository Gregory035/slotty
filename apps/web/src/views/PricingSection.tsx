import { catalog } from '../../../api/src/billing/catalog';
import { useState } from 'react';
import { CalendarDays, Users, ChartColumn, Bell, Building2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import './pricing-section.css';

const plans = [
  { name: 'FREE', ...catalog.FREE, audience: 'Чтобы начать принимать клиентов', note: 'Бесплатно навсегда' },
  { name: 'SOLO', ...catalog.SOLO, audience: 'Для самостоятельного специалиста', note: 'История клиентов и уведомления' },
  { name: 'TEAM', ...catalog.TEAM, audience: 'Для небольших команд', note: 'Управление сотрудниками и аналитика' },
  { name: 'BUSINESS', ...catalog.BUSINESS, audience: 'Для растущей компании', note: 'Все возможности TEAM' },
] as const;
const rows = ['Онлайн-запись через Telegram','Календарь','Telegram-уведомления','Клиентская база и история','Управление персоналом','Аналитика','Несколько филиалов'];
const matrix = [
  ['Да','Базовый','–','–','–','–','–'],
  ['Да','Да','Да','Да','–','–','–'],
  ['Да','Да','Да','Да','Да','Да','–'],
  ['Да','Да','Да','Да','Да','Базовая; расширенная – скоро','Скоро'],
];
export function PricingSection(){
  const [team,setTeam]=useState(''), [bookings,setBookings]=useState('');
  const picks=!team||!bookings?[]:team==='solo'?(bookings==='unknown'?[0,1]:[bookings==='low'?0:1]):team==='small'?[2]:team==='large'?[3]:[];
  return <section id="pricing" className="price-section" aria-labelledby="pricing-title"><h2 id="pricing-title">Тариф под ваше расписание</h2><p>Цены за месяц. Начните с бесплатного тарифа или выберите план для команды.</p>
  <div className="price-grid">{plans.map((p,i)=><article key={p.name} data-picked={picks.includes(i)}><header><h3>{p.name}</h3>{i===2&&<Users aria-label="Командный тариф"/>}</header><strong>{p.price} ₽</strong><span> / мес.</span><p>{p.audience}</p><ul><li><Users/> {p.staff===1?'1 специалист':'До '+p.staff+' специалистов'}</li><li><CalendarDays/> {p.limit?'30 записей в месяц':'Записи без лимита'}</li><li><Check/> Запись через Telegram</li><li>{i===1?<Bell/>:i>1?<ChartColumn/>:<Check/>} {p.note}</li>{i===3&&<li><Building2/> Филиалы – скоро</li>}</ul><Link to={'/app?mode=register&plan='+p.name}>Выбрать {p.name}</Link></article>)}</div>
  <h3>Какой тариф подходит именно вам?</h3><p>Не знаете, что выбрать? Подберём тариф за 15 секунд.</p><div className="price-quiz"><label>Сколько специалистов работает у вас?<select value={team} onChange={e=>setTeam(e.target.value)}><option value="">Выберите команду</option><option value="solo">Только я</option><option value="small">2–5 человек</option><option value="large">6–15 человек</option><option value="more">Более 15 человек</option></select></label><label>Сколько записей планируете в месяц?<select value={bookings} onChange={e=>setBookings(e.target.value)}><option value="">Выберите объём</option><option value="low">До 30</option><option value="high">Более 30</option><option value="unknown">Пока не знаю</option></select></label></div>
  <div aria-live="polite">{team==='more'?<p>Для команды больше 15 человек <a href="mailto:support@slotty23.ru">свяжитесь со Slotty</a>.</p>:picks.length===2?<p>Сравните FREE и SOLO: начните бесплатно, если пока не знаете объём записей.</p>:picks.map(i=><p key={i}>Вам подойдёт {plans[i]!.name} – {plans[i]!.price} ₽/мес. {plans[i]!.audience}. <Link to={'/app?mode=register&plan='+plans[i]!.name}>Подключить</Link></p>)}</div>
  <details><summary>Сравнить все возможности</summary><div className="price-scroll" tabIndex={0}><table><thead><tr><th>Возможность</th>{plans.map(p=><th key={p.name}>{p.name}</th>)}</tr></thead><tbody>{['Стоимость','Сотрудники','Записи в месяц',...rows].map((label,r)=><tr key={label}><th scope="row">{label}</th>{plans.map((p,i)=><td key={p.name}>{r===0?p.price+' ₽/мес.':r===1?p.staff:r===2?p.limit??'Без лимита':matrix[i]?.[r-3]}</td>)}</tr>)}</tbody></table></div></details></section>
}
