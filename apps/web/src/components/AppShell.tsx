import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Command,
  Clock3,
  ContactRound,
  LayoutDashboard,
  ChartNoAxesCombined,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
  Search,
  Settings,
  Star,
  Sun,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../api';
import { useAppStore } from '../store';
import type { Company, Section } from '../types';
import { Brand } from './Brand';

const navigation: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Обзор', icon: LayoutDashboard },
  { id: 'analytics', label: 'Аналитика', icon: ChartNoAxesCombined },
  { id: 'calendar', label: 'Календарь', icon: CalendarDays },
  { id: 'appointments', label: 'Записи', icon: CalendarDays },
  { id: 'customers', label: 'Клиенты', icon: ContactRound },
  { id: 'reviews', label: 'Отзывы', icon: Star },
  { id: 'services', label: 'Услуги', icon: Scissors },
  { id: 'employees', label: 'Команда', icon: UsersRound },
  { id: 'schedule', label: 'Расписание', icon: Clock3 },
  { id: 'bot', label: 'Telegram-бот', icon: Bot },
  { id: 'members', label: 'Участники', icon: UsersRound },
  { id: 'billing', label: 'Тариф', icon: CircleDollarSign },
  { id: 'settings', label: 'Настройки', icon: Settings },
  { id: 'audit', label: 'Журнал', icon: ClipboardList },
];

export function AppShell({
  companies,
  activeCompany,
  section,
  children,
}: {
  companies: Company[];
  activeCompany: Company;
  section: Section;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {
    session,
    sidebarOpen,
    sidebarCollapsed,
    toggleSidebar,
    closeSidebar,
    toggleSidebarCollapsed,
    setSession,
    setActiveCompanyId,
  } = useAppStore();
  const { themeMode, setThemeMode } = useAppStore();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const daysLeft = trialDays(activeCompany.trialEndsAt);

  async function signOut() {
    await logout();
    queryClient.clear();
    setSession(null);
  }

  const initials = `${session?.user.firstName?.[0] ?? ''}${session?.user.lastName?.[0] ?? ''}` || 'В';
  const sectionTitle = navigation.find((item) => item.id === section)?.label ?? 'Обзор';
  const visibleNavigation = navigation.filter((item) => {
    if (activeCompany.role === 'EMPLOYEE') return ['calendar', 'appointments', 'schedule'].includes(item.id);
    if (activeCompany.role === 'ADMIN') return item.id !== 'billing';
    return true;
  });

  function openSection(next: Section) {
    closeSidebar();
    navigate(`/companies/${activeCompany.id}/${next}`);
  }

  function selectCompany(companyId: string) {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;
    setActiveCompanyId(companyId);
    navigate(`/companies/${companyId}/${company.role === 'EMPLOYEE' ? 'calendar' : 'dashboard'}`);
  }

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''} ${sidebarOpen ? 'mobile-sidebar-open' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-head">
          <Link
            className="brand-home"
            to={`/companies/${activeCompany.id}/${activeCompany.role === 'EMPLOYEE' ? 'calendar' : 'dashboard'}`}
            onClick={closeSidebar}
            aria-label="Slotty — перейти на главную"
          >
            <Brand compact={sidebarCollapsed} />
          </Link>
          <button
            className="sidebar-collapse"
            onClick={toggleSidebarCollapsed}
            title={sidebarCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
            aria-label={sidebarCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
            aria-pressed={sidebarCollapsed}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button className="sidebar-close" onClick={closeSidebar} aria-label="Закрыть меню"><X size={20} /></button>
        </div>

        <div className="sidebar-company" title={sidebarCollapsed ? activeCompany.name : undefined}>
          <span className="company-symbol" aria-hidden="true"><Building2 size={17} strokeWidth={1.8} /></span>
          <div className="sidebar-company-copy"><small>Рабочее пространство</small><strong>{activeCompany.name}</strong></div>
          {companies.length > 1 && (
            <>
              <select aria-label="Выбрать компанию" value={activeCompany.id} onChange={(event) => selectCompany(event.target.value)}>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
              <ChevronDown size={15} />
            </>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Основная навигация">
          <p>Рабочее пространство</p>
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={section === item.id ? 'active' : ''}
                onClick={() => openSection(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                aria-label={item.label}
                aria-current={section === item.id ? 'page' : undefined}
              >
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
        </div>

        <div className="sidebar-user" title={sidebarCollapsed ? `${session?.user.firstName ?? ''} ${session?.user.lastName ?? ''}`.trim() : undefined}>
          <span className="avatar avatar-small">{initials.toUpperCase()}</span>
          <div className="sidebar-user-copy"><strong>{session?.user.firstName} {session?.user.lastName}</strong><span>{session?.user.email}</span></div>
          <button onClick={signOut} title="Выйти" aria-label="Выйти"><LogOut size={17} /></button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-overlay" onClick={closeSidebar} aria-label="Закрыть меню" />}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={toggleSidebar} aria-label="Открыть меню"><Menu size={20} /></button>
            <Link
              className="mobile-brand brand-home"
              to={`/companies/${activeCompany.id}/${activeCompany.role === 'EMPLOYEE' ? 'calendar' : 'dashboard'}`}
              aria-label="Slotty — перейти на главную"
            >
              <Brand compact />
            </Link>
            <strong className="topbar-title">{sectionTitle}</strong>
          </div>
          <div className="topbar-actions">
            <button className="command-trigger" onClick={() => setPaletteOpen(true)} aria-label="Открыть поиск и команды"><Search size={16} /><span>Поиск</span><kbd>⌘ K</kbd></button>
            <button className="icon-button topbar-icon" aria-label="Уведомления"><Bell size={18} /></button>
            <div className="theme-switch" aria-label="Тема интерфейса">
              <button className={themeMode === 'light' ? 'active' : ''} onClick={() => setThemeMode('light')} aria-label="Светлая тема"><Sun size={15} /></button>
              <button className={themeMode === 'dark' ? 'active' : ''} onClick={() => setThemeMode('dark')} aria-label="Тёмная тема"><Moon size={15} /></button>
            </div>
          </div>
        </header>
        <div className="page-container">{children}</div>
        <nav className="mobile-bottom-nav" aria-label="Быстрая навигация">
          {visibleNavigation.filter((item) => ['dashboard', 'calendar', 'appointments', 'customers', 'bot'].includes(item.id)).slice(0, 5).map((item) => { const Icon = item.icon; return <button key={item.id} className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => openSection(item.id)}><Icon size={18} /><span>{item.label}</span></button>; })}
        </nav>
      </div>
      {paletteOpen && <CommandPalette close={() => setPaletteOpen(false)} openSection={openSection} setThemeMode={setThemeMode} />}
    </div>
  );
}

function CommandPalette({ close, openSection, setThemeMode }: { close: () => void; openSection: (section: Section) => void; setThemeMode: (mode: 'light' | 'dark' | 'system') => void }) {
  const [query, setQuery] = useState('');
  const commands: Array<{ label: string; hint: string; action: () => void }> = [
    { label: 'Открыть календарь', hint: 'Навигация', action: () => openSection('calendar') },
    { label: 'Все записи', hint: 'Навигация', action: () => openSection('appointments') },
    { label: 'Аналитика', hint: 'Показатели', action: () => openSection('analytics') },
    { label: 'Клиенты', hint: 'Навигация', action: () => openSection('customers') },
    { label: 'Telegram-бот', hint: 'Канал записи', action: () => openSection('bot') },
    { label: 'Светлая тема', hint: 'Интерфейс', action: () => setThemeMode('light') },
    { label: 'Тёмная тема', hint: 'Интерфейс', action: () => setThemeMode('dark') },
  ];
  const visible = commands.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  const run = (action: () => void) => { action(); close(); };
  return <div className="command-backdrop" onMouseDown={close}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Команды" onMouseDown={(event) => event.stopPropagation()}><label><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти команду" /></label><div>{visible.map((item) => <button key={item.label} onClick={() => run(item.action)}><span><Command size={15} />{item.label}</span><small>{item.hint}</small></button>)}{!visible.length && <p>Ничего не найдено</p>}</div></section></div>;
}

function trialDays(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
}
