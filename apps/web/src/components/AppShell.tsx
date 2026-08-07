import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Scissors,
  UsersRound,
  X,
} from 'lucide-react';
import { logout } from '../api';
import { useAppStore } from '../store';
import type { Company, Section } from '../types';
import { Brand } from './Brand';

const navigation: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'appointments', label: 'Записи', icon: CalendarDays },
  { id: 'services', label: 'Услуги', icon: Scissors },
  { id: 'employees', label: 'Команда', icon: UsersRound },
  { id: 'bot', label: 'Telegram-бот', icon: Bot },
];

export function AppShell({
  companies,
  activeCompany,
  children,
}: {
  companies: Company[];
  activeCompany: Company;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const {
    session,
    section,
    sidebarOpen,
    setSection,
    toggleSidebar,
    closeSidebar,
    setSession,
    setActiveCompanyId,
  } = useAppStore();
  const daysLeft = trialDays(activeCompany.trialEndsAt);

  async function signOut() {
    await logout();
    queryClient.clear();
    setSession(null);
  }

  const initials = `${session?.user.firstName?.[0] ?? ''}${session?.user.lastName?.[0] ?? ''}` || 'В';
  const sectionTitle = navigation.find((item) => item.id === section)?.label ?? 'Обзор';

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head">
          <Brand />
          <button className="sidebar-close" onClick={closeSidebar} aria-label="Закрыть меню"><X size={20} /></button>
        </div>

        <div className="sidebar-company">
          <span className="company-symbol">{activeCompany.name.trim().charAt(0).toUpperCase()}</span>
          <div><small>Рабочее пространство</small><strong>{activeCompany.name}</strong></div>
          {companies.length > 1 && (
            <>
              <select aria-label="Выбрать компанию" value={activeCompany.id} onChange={(event) => setActiveCompanyId(event.target.value)}>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
              <ChevronDown size={15} />
            </>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Основная навигация">
          <p>Управление</p>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}>
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.id === 'appointments' && <i>Live</i>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-trial">
          <div><span>Пробный период</span><strong>{daysLeft} дн.</strong></div>
          <div className="trial-track"><span style={{ width: `${Math.min(100, (daysLeft / 14) * 100)}%` }} /></div>
          <p>Все функции доступны</p>
        </div>

        <div className="sidebar-user">
          <span className="avatar avatar-small">{initials.toUpperCase()}</span>
          <div><strong>{session?.user.firstName} {session?.user.lastName}</strong><span>{session?.user.email}</span></div>
          <button onClick={signOut} title="Выйти" aria-label="Выйти"><LogOut size={17} /></button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-overlay" onClick={closeSidebar} aria-label="Закрыть меню" />}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={toggleSidebar} aria-label="Открыть меню"><Menu size={20} /></button>
            <div className="mobile-brand"><Brand compact /></div>
            <strong className="topbar-title">{sectionTitle}</strong>
          </div>
          <div className="topbar-status"><span /><p><strong>{activeCompany.name}</strong><small>{activeCompany.timezone}</small></p></div>
        </header>
        <div className="page-container">{children}</div>
      </div>
    </div>
  );
}

function trialDays(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
}
