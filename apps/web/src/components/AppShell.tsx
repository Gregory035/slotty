import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  Download,
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
  ServerCog,
  Star,
  Sun,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { deletePushSubscription, getPushPreferences, logout, sendTestPush, updatePushPreferences } from '../api';
import { disableDevicePush, enableDevicePush, notificationPermission, prepareDevicePush, pushSupportMessage, syncDevicePush, type DevicePushSetup, type PushConnectionStep } from '../push';
import { useAppStore } from '../store';
import type { Company, PushPreferences, Section } from '../types';
import { Brand } from './Brand';
import { useToast } from './ToastProvider';
import { Modal } from './ui';
import { DialogLayer } from './DialogLayer';
import { errorMessage } from '../utils';
import { lockPageScroll } from '../scroll-lock';

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
  { id: 'system', label: 'Система', icon: ServerCog },
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
  const { notify } = useToast();
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
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [pushActive, setPushActive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const [pushPreferences, setPushPreferences] = useState<PushPreferences | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState(notificationPermission);
  const [pushSetup, setPushSetup] = useState<DevicePushSetup | null>(null);
  const [pushPreparing, setPushPreparing] = useState(false);
  const [pushStep, setPushStep] = useState<PushConnectionStep | null>(null);
  const daysLeft = trialDays(activeCompany.trialEndsAt);
  const isTrial = activeCompany.subscriptionPlan === 'TRIAL';
  const planLabel = activeCompany.subscriptionPlan === 'PRO' ? 'Pro' : activeCompany.subscriptionPlan === 'STARTER' ? 'Starter' : 'Подписка';
  const subscriptionLabel = activeCompany.subscriptionStatus === 'ACTIVE' ? 'Активна' : activeCompany.subscriptionStatus === 'PAST_DUE' ? 'Ожидает оплаты' : activeCompany.subscriptionStatus === 'EXPIRED' || activeCompany.subscriptionStatus === 'CANCELLED' ? 'Неактивна' : 'Не подключена';
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 820px)').matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const mobileMenuOpen = mobile && sidebarOpen;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)');
    const change = () => { setMobile(media.matches); if (!media.matches) closeSidebar(); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [closeSidebar]);

  async function signOut() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await deletePushSubscription(subscription.endpoint);
        }
      } catch {
        // Logout must remain available if the browser push service is offline.
      }
    }
    await logout();
    queryClient.clear();
    setSession(null);
  }

  const initials = `${session?.user.firstName?.[0] ?? ''}${session?.user.lastName?.[0] ?? ''}` || 'В';
  const solo = activeCompany.workingMode === 'SOLO' && activeCompany.role === 'OWNER';
  const workspaceNavigation = navigation.map((item) => ({ ...item, label: solo
    ? ({ dashboard: 'Сегодня', employees: 'Мой профиль', schedule: 'Моё расписание' } as Partial<Record<Section, string>>)[item.id] ?? item.label
    : item.label }));
  const sectionTitle = activeCompany.role === 'EMPLOYEE' && section === 'employees'
    ? 'Мои работы'
    : workspaceNavigation.find((item) => item.id === section)?.label ?? 'Обзор';
  const visibleNavigation = workspaceNavigation.filter((item) => {
    if (solo && item.id === 'members') return false;
    if (activeCompany.role === 'EMPLOYEE') return ['calendar', 'appointments', 'employees', 'schedule'].includes(item.id);
    if (activeCompany.role === 'ADMIN') return item.id !== 'billing' && item.id !== 'system';
    return true;
  });

  function openSection(next: Section) {
    closeSidebar();
    void navigate(`/companies/${activeCompany.id}/${next}`);
  }

  function selectCompany(companyId: string) {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;
    setActiveCompanyId(companyId);
    void navigate(`/companies/${companyId}/${company.role === 'EMPLOYEE' ? 'calendar' : 'dashboard'}`);
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
    let active = true;
    const sync = () => {
      if (document.visibilityState === 'hidden') return;
      setPushPermission(notificationPermission());
      void syncDevicePush().then((subscription) => {
        if (active) setPushActive(Boolean(subscription));
      }).catch((caught: unknown) => {
        if (active) { setPushActive(false); setPushError(errorText(caught)); }
      });
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { active = false; document.removeEventListener('visibilitychange', sync); };
  }, []);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    window.alert(isAndroidBrowser()
      ? 'В Chrome откройте меню ⋮ и выберите «Установить приложение» или «Добавить на главный экран».'
      : 'На iPhone откройте меню «Поделиться» и выберите «На экран Домой».');
  }

  async function openPushSettings() {
    setPushSettingsOpen(true);
    setPushMessage(null);
    setPushError(null);
    setPushSetup(null);
    setPushPreparing(true);
    setPushPermission(notificationPermission());
    try {
      const [preferences, setup] = await Promise.all([
        getPushPreferences(),
        pushSupportMessage() ? Promise.resolve(null) : prepareDevicePush(),
      ]);
      setPushPreferences(preferences);
      setPushSetup(setup);
      setPushActive(Boolean(setup?.subscription) && notificationPermission() === 'granted');
    } catch (caught) {
      setPushError(errorText(caught));
    } finally {
      setPushPreparing(false);
    }
  }

  async function togglePush() {
    if (pushBusy || pushPreparing || (!pushActive && !pushSetup)) return;
    // Start immediately in the click handler, before any network/worker await.
    const operation = pushActive ? disableDevicePush() : enableDevicePush(pushSetup!, setPushStep);
    setPushBusy(true);
    setPushError(null);
    setPushMessage(null);
    try {
      const subscription = await operation;
      setPushActive(!pushActive);
      setPushSetup((current) => current ? { ...current, subscription: subscription ?? null } : null);
      setPushMessage(pushActive ? 'Уведомления выключены на этом устройстве.' : 'Уведомления включены. Теперь нажмите «Тестовое уведомление».');
    } catch (caught) {
      setPushError(errorText(caught));
    } finally {
      setPushPermission(notificationPermission());
      setPushStep(null);
      setPushBusy(false);
    }
  }

  async function savePreferences(next: PushPreferences) {
    setPushBusy(true);
    try {
      setPushPreferences(await updatePushPreferences(next));
      notify('Настройки уведомлений сохранены');
    } catch (caught) {
      notify(errorText(caught), 'error');
    } finally {
      setPushBusy(false);
    }
  }

  async function testPush() {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    setPushMessage(null);
    try {
      const subscription = await syncDevicePush();
      if (!subscription) {
        setPushActive(false);
        throw new Error('Сначала включите уведомления на этом устройстве.');
      }
      await sendTestPush(subscription.endpoint);
      setPushMessage('Push-сервис принял тест для этого устройства. Если баннер не появился, проверьте «Настройки → Уведомления → Slotty», режим фокусирования и сводку уведомлений.');
    } catch (caught) {
      setPushError(errorText(caught));
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const unlock = lockPageScroll();
    const menuButton = menuRef.current;
    sidebarRef.current?.querySelector<HTMLButtonElement>('.sidebar-close')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') { event.preventDefault(); closeSidebar(); }
      if (event.key !== 'Tab') return;
      const items = [...(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), select:not(:disabled)') ?? [])].filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).display !== 'none');
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      unlock();
      document.removeEventListener('keydown', keydown);
      if (window.matchMedia('(max-width: 820px)').matches) menuButton?.focus({ preventScroll: true });
    };
  }, [mobileMenuOpen, closeSidebar]);

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''} ${sidebarOpen ? 'mobile-sidebar-open' : ''}`}>
      <aside ref={sidebarRef} className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} inert={mobile && !sidebarOpen} aria-hidden={mobile && !sidebarOpen ? true : undefined} role={mobileMenuOpen ? 'dialog' : undefined} aria-modal={mobileMenuOpen ? true : undefined} aria-label="Навигация рабочего пространства">
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
          <div className="sidebar-company-copy"><strong>{activeCompany.name}</strong></div>
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
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const label = activeCompany.role === 'EMPLOYEE' && item.id === 'employees' ? 'Мои работы' : item.label;
            return (
              <button
                key={item.id}
                className={section === item.id ? 'active' : ''}
                onClick={() => openSection(item.id)}
                title={sidebarCollapsed ? label : undefined}
                aria-label={label}
                aria-current={section === item.id ? 'page' : undefined}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-trial">
          <div><span>{isTrial ? 'Пробный период' : planLabel}</span><strong>{isTrial ? `${daysLeft} дн.` : subscriptionLabel}</strong></div>
          {isTrial && <div className="trial-track"><span style={{ width: `${Math.min(100, (daysLeft / 14) * 100)}%` }} /></div>}
        </div>

        <div className="sidebar-user" title={sidebarCollapsed ? `${session?.user.firstName ?? ''} ${session?.user.lastName ?? ''}`.trim() : undefined}>
          <span className="avatar avatar-small">{initials.toUpperCase()}</span>
          <div className="sidebar-user-copy"><strong>{session?.user.firstName} {session?.user.lastName}</strong><span>{session?.user.email}</span></div>
          <button onClick={signOut} title="Выйти" aria-label="Выйти"><LogOut size={17} /></button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-overlay" onClick={closeSidebar} aria-label="Закрыть меню" />}

      <div className="app-main" inert={mobileMenuOpen}>
        <a className="skip-link" href="#workspace-content">К содержимому</a>
        <header className="topbar">
          <div className="topbar-left">
            <button ref={menuRef} className="mobile-menu" onClick={toggleSidebar} aria-expanded={mobileMenuOpen} aria-label="Открыть меню"><Menu size={20} /></button>
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
            {(installPrompt || isIosBrowser() || isAndroidBrowser()) && !isStandalone() && <button className="icon-button topbar-icon" onClick={() => void installApp()} title="Установить Slotty" aria-label="Установить Slotty"><Download size={18} /></button>}
            <button className="command-trigger" onClick={() => setPaletteOpen(true)} aria-label="Открыть поиск и команды"><Search size={16} /><span>Поиск</span><kbd>⌘ K</kbd></button>
            <button
              className={`icon-button topbar-icon ${pushActive ? 'active' : ''}`}
              onClick={() => void openPushSettings()}
              aria-label="Настройки push-уведомлений"
              title={pushActive ? 'Push-уведомления включены' : 'Настроить push-уведомления'}
              disabled={pushBusy}
            ><Bell size={18} /></button>
            <div className="theme-switch" aria-label="Тема интерфейса">
              <button className={themeMode === 'light' ? 'active' : ''} onClick={() => setThemeMode('light')} aria-label="Светлая тема"><Sun size={15} /></button>
              <button className={themeMode === 'dark' ? 'active' : ''} onClick={() => setThemeMode('dark')} aria-label="Тёмная тема"><Moon size={15} /></button>
            </div>
          </div>
        </header>
        <main id="workspace-content" className="page-container" tabIndex={-1}>{children}</main>
        <nav className="mobile-bottom-nav" aria-label="Быстрая навигация">
          {visibleNavigation.filter((item) => activeCompany.role === 'EMPLOYEE'
            ? ['calendar', 'appointments', 'employees', 'schedule'].includes(item.id)
            : ['dashboard', 'calendar', 'appointments', 'customers', 'bot'].includes(item.id)).slice(0, 5).map((item) => { const Icon = item.icon; const label = activeCompany.role === 'EMPLOYEE' && item.id === 'employees' ? 'Работы' : item.label; return <button key={item.id} className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => openSection(item.id)}><Icon size={18} /><span>{label}</span></button>; })}
        </nav>
      </div>
      {paletteOpen && <CommandPalette close={() => setPaletteOpen(false)} openSection={openSection} setThemeMode={setThemeMode} />}
      <Modal open={pushSettingsOpen} title="Уведомления" description="Подключение этого устройства и события вашего аккаунта." className="push-settings-modal" onClose={() => setPushSettingsOpen(false)}>
        <div className="push-settings">
          <div className="push-settings-status"><span className={pushActive ? 'is-active' : ''} />{pushActive ? 'Включены на этом устройстве' : 'Выключены на этом устройстве'}</div>
          <div className="push-device-actions">
            <button className={pushActive ? 'secondary-button' : 'primary-button'} onClick={() => void togglePush()} disabled={pushBusy || pushPreparing || (!pushActive && !pushSetup) || Boolean(pushSupportMessage())}>{pushPreparing ? 'Подготавливаем подключение…' : pushBusy ? pushStep === 'permission' ? 'Ожидаем разрешение iOS…' : pushStep === 'subscription' ? 'Подключаем устройство…' : pushStep === 'saving' ? 'Сохраняем подключение…' : 'Подождите…' : pushActive ? 'Выключить на устройстве' : 'Включить уведомления'}</button>
            <button className="secondary-button" onClick={() => void testPush()} disabled={!pushActive || pushBusy}>Тестовое уведомление</button>
          </div>
          {!pushActive && !pushSupportMessage() && <p className="form-notice">Сначала нажмите «Включить уведомления» и разрешите их в системном окне. После подключения станет доступен тест.</p>}
          {pushSupportMessage() && <p className="form-notice">{pushSupportMessage()}</p>}
          {pushError && <p className="form-error" role="alert">{pushError}</p>}
          {!pushSetup && !pushPreparing && !pushSupportMessage() && <button className="secondary-button" onClick={() => void openPushSettings()}>Повторить подготовку</button>}
          {pushMessage && <p className="form-notice" role="status">{pushMessage}</p>}
          {pushPreferences && <fieldset disabled={pushBusy}>
            <legend>О каких событиях сообщать</legend>
            <label><input type="checkbox" checked={pushPreferences.appointmentCreated} onChange={(event) => void savePreferences({ ...pushPreferences, appointmentCreated: event.target.checked })} />Новая запись</label>
            <label><input type="checkbox" checked={pushPreferences.appointmentRescheduled} onChange={(event) => void savePreferences({ ...pushPreferences, appointmentRescheduled: event.target.checked })} />Перенос записи</label>
            <label><input type="checkbox" checked={pushPreferences.appointmentCancelled} onChange={(event) => void savePreferences({ ...pushPreferences, appointmentCancelled: event.target.checked })} />Отмена записи</label>
          </fieldset>}
          {pushPermission === 'denied' && <p className="form-notice">{isIosBrowser() ? 'На iPhone: Настройки → Уведомления → Slotty → Допуск уведомлений. После изменения вернитесь в Slotty.' : 'Уведомления заблокированы. Разрешите их для Slotty в настройках сайта вашего браузера.'}</p>}
          <div className="modal-actions"><button className="primary-button" onClick={() => setPushSettingsOpen(false)}>Готово</button></div>
        </div>
      </Modal>
    </div>
  );
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIosBrowser() {
  return /iPhone|iPad|iPod/u.test(navigator.userAgent);
}

function isAndroidBrowser() {
  return /Android/u.test(navigator.userAgent);
}

function errorText(error: unknown): string {
  return errorMessage(error);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
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
  return <DialogLayer className="command-backdrop" onClose={close} label="Команды"><section className="command-palette" onMouseDown={(event) => event.stopPropagation()}><label><Search size={18} /><input aria-label="Найти команду" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти команду" /></label><div>{visible.map((item) => <button key={item.label} onClick={() => run(item.action)}><span><Command size={15} />{item.label}</span><small>{item.hint}</small></button>)}{!visible.length && <p>Ничего не найдено</p>}</div></section></DialogLayer>;
}

function trialDays(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
}
