import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { trackEvent } from '../analytics';
import { Brand } from '../components/Brand';

export function MarketingLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const links = [['/online-zapis', 'Возможности'], ['/dlya-mastera', 'Для мастера'], ['/dlya-salona', 'Для салона'], ['/zapis-cherez-telegram', 'Telegram']] as const;
  return <div className="landing-page">
    <header className="landing-nav">
      <Link className="brand-home" to="/" aria-label="Slotty — главная"><Brand /></Link>
      <nav className="landing-links" aria-label="Основная навигация">{links.map(([to, label]) => <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined}>{label}</Link>)}</nav>
      <Link className="secondary-button landing-login" to="/app" onClick={() => trackEvent('landing_login')}>Войти</Link>
    </header>
    <main>{children}</main>
    <footer className="landing-footer"><Link className="brand-home" to="/" aria-label="Slotty — главная"><Brand /></Link><span>© {new Date().getFullYear()} Slotty</span><Link to="/online-zapis">Онлайн-запись</Link><Link to="/privacy">Конфиденциальность</Link><Link to="/cookies">Cookie</Link><Link to="/terms">Условия</Link><Link to="/offer">Оферта</Link><Link to="/data-processing">Обработка данных</Link><Link to="/app" onClick={() => trackEvent('landing_login')}>Войти</Link></footer>
  </div>;
}
