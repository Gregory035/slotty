import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../analytics';
import { Brand } from '../components/Brand';

export function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="landing-page">
    <header className="landing-nav">
      <Link className="brand-home" to="/" aria-label="Slotty — главная"><Brand /></Link>
      <nav className="landing-links" aria-label="Основная навигация"><Link to="/online-zapis">Онлайн-запись</Link><Link to="/zapis-cherez-telegram">Telegram</Link><a href="/#how">Как работает</a></nav>
      <Link className="secondary-button landing-login" to="/app" onClick={() => trackEvent('landing_login')}>Войти</Link>
    </header>
    <main>{children}</main>
    <footer className="landing-footer"><Link className="brand-home" to="/" aria-label="Slotty — главная"><Brand /></Link><span>© {new Date().getFullYear()} Slotty</span><Link to="/online-zapis">Онлайн-запись</Link><Link to="/zapis-cherez-telegram">Запись через Telegram</Link><Link to="/app" onClick={() => trackEvent('landing_login')}>Войти в панель</Link></footer>
  </div>;
}
