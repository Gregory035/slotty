import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getCompanies, getEntitlements, restoreSession } from './api';
import { AppShell } from './components/AppShell';
import { AuthScreen } from './components/AuthScreen';
import { CompanyOnboarding } from './components/CompanyOnboarding';
import { ErrorBlock, LoadingBlock, Modal } from './components/ui';
import { useAppStore } from './store';
import type { Company, Section } from './types';
import './styles.css';

const OverviewView = lazy(() => import('./views/OverviewView').then((module) => ({ default: module.OverviewView })));
const AnalyticsView = lazy(() => import('./views/AnalyticsView').then((module) => ({ default: module.AnalyticsView })));
const AppointmentsView = lazy(() => import('./views/AppointmentsView').then((module) => ({ default: module.AppointmentsView })));
const CalendarView = lazy(() => import('./views/CalendarView').then((module) => ({ default: module.CalendarView })));
const CustomersView = lazy(() => import('./views/CustomersView').then((module) => ({ default: module.CustomersView })));
const ReviewsView = lazy(() => import('./views/ReviewsView').then((module) => ({ default: module.ReviewsView })));
const ServicesView = lazy(() => import('./views/ServicesView').then((module) => ({ default: module.ServicesView })));
const EmployeesView = lazy(() => import('./views/EmployeesView').then((module) => ({ default: module.EmployeesView })));
const ScheduleView = lazy(() => import('./views/ScheduleView').then((module) => ({ default: module.ScheduleView })));
const BotView = lazy(() => import('./views/BotView').then((module) => ({ default: module.BotView })));
const MembersView = lazy(() => import('./views/MembersView').then((module) => ({ default: module.MembersView })));
const BillingView = lazy(() => import('./views/BillingView').then((module) => ({ default: module.BillingView })));
const SettingsView = lazy(() => import('./views/SettingsView').then((module) => ({ default: module.SettingsView })));
const AuditView = lazy(() => import('./views/AuditView').then((module) => ({ default: module.AuditView })));

const sections: Section[] = ['dashboard', 'analytics', 'calendar', 'appointments', 'customers', 'reviews', 'services', 'employees', 'schedule', 'bot', 'members', 'billing', 'settings', 'audit'];
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export function WorkspaceApp() {
  return <QueryClientProvider client={queryClient}><WorkspaceRouter /></QueryClientProvider>;
}

function WorkspaceRouter() {
  const [restoringSession, setRestoringSession] = useState(true);
  const session = useAppStore((state) => state.session);
  const activeCompanyId = useAppStore((state) => state.activeCompanyId);
  const setActiveCompanyId = useAppStore((state) => state.setActiveCompanyId);
  const setSession = useAppStore((state) => state.setSession);
  const themeMode = useAppStore((state) => state.themeMode);
  const companies = useQuery({ queryKey: ['companies', session?.user.id], queryFn: getCompanies, enabled: Boolean(session) });

  useEffect(() => {
    const expire = () => setSession(null);
    window.addEventListener('auth-expired', expire);
    return () => window.removeEventListener('auth-expired', expire);
  }, [setSession]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = themeMode === 'dark' || (themeMode === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    if (themeMode !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [themeMode]);

  useEffect(() => {
    let active = true;
    void restoreSession().then((restored) => {
      if (active) { setSession(restored); setRestoringSession(false); }
    });
    return () => { active = false; };
  }, [setSession]);

  useEffect(() => {
    if (!companies.data?.length) return;
    if (!activeCompanyId || !companies.data.some((item) => item.id === activeCompanyId)) setActiveCompanyId(companies.data[0]!.id);
  }, [activeCompanyId, companies.data, setActiveCompanyId]);

  return <WorkspaceGate restoringSession={restoringSession} session={session} companies={companies.data} companiesLoading={companies.isLoading} companiesError={Boolean(companies.error)} />;
}

function WorkspaceGate({ restoringSession, session, companies, companiesLoading, companiesError }: { restoringSession: boolean; session: ReturnType<typeof useAppStore.getState>['session']; companies: Company[] | undefined; companiesLoading: boolean; companiesError: boolean }) {
  if (restoringSession) return <div className="fullscreen-state"><LoadingBlock label="Открываем Slotty" /></div>;
  if (!session) return <AuthScreen />;
  if (companiesLoading) return <div className="fullscreen-state"><LoadingBlock label="Открываем рабочее пространство" /></div>;
  if (companiesError) return <div className="fullscreen-state"><ErrorBlock message="Не удалось загрузить компании. Убедитесь, что API запущен." /></div>;
  if (!companies?.length) return <CompanyOnboarding />;
  return <CompanyWorkspace companies={companies} />;
}

function CompanyWorkspace({ companies }: { companies: Company[] }) {
  const { companyId, section: rawSection } = useParams();
  const company = companies.find((item) => item.id === companyId);
  const setActiveCompanyId = useAppStore((state) => state.setActiveCompanyId);
  useEffect(() => { if (company?.id) setActiveCompanyId(company.id); }, [company?.id, setActiveCompanyId]);
  if (!company) return <Navigate replace to={`/companies/${companies[0]!.id}/${companies[0]!.role === 'EMPLOYEE' ? 'calendar' : 'dashboard'}`} />;
  const section = sections.includes(rawSection as Section) ? rawSection as Section : company.role === 'EMPLOYEE' ? 'calendar' : 'dashboard';
  const allowed = allowedSections(company);
  if (!allowed.includes(section)) return <Navigate replace to={`/companies/${company.id}/${allowed[0]}`} />;
  const content: Record<Section, ReactNode> = {
    dashboard: <OverviewView company={company} />, analytics: <AnalyticsView company={company} />, calendar: <CalendarView company={company} />, appointments: <AppointmentsView company={company} />, customers: <CustomersView company={company} />, reviews: <ReviewsView company={company} />, services: <ServicesView company={company} />, employees: <EmployeesView company={company} />, schedule: <ScheduleView company={company} />, bot: <BotView company={company} />, members: <MembersView company={company} />, billing: <BillingView company={company} />, settings: <SettingsView company={company} />, audit: <AuditView company={company} />,
  };
  return <AppShell companies={companies} activeCompany={company} section={section}><SubscriptionExpiryNotice company={company} /><Suspense fallback={<LoadingBlock />}>{content[section]}</Suspense></AppShell>;
}

function SubscriptionExpiryNotice({ company }: { company: Company }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const billing = useQuery({ queryKey: ['billing', company.id], queryFn: () => getEntitlements(company.id), staleTime: 60_000 });
  const trialExpired = billing.data?.status === 'TRIALING' && !billing.data.active;
  useEffect(() => setDismissed(false), [company.id]);
  if (!trialExpired || dismissed) return null;
  const canPurchase = company.role === 'OWNER';
  return <Modal open title="Пробный период завершён" description="Новые записи и изменения временно остановлены. Выберите тариф, чтобы продолжить работу Slotty." onClose={() => setDismissed(true)}><div className="modal-actions"><button className="secondary-button" onClick={() => setDismissed(true)}>Позже</button>{canPurchase ? <button className="primary-button" onClick={() => { setDismissed(true); navigate(`/companies/${company.id}/billing`); }}>Выбрать тариф</button> : <span className="muted-text">Обратитесь к владельцу, чтобы оформить подписку.</span>}</div></Modal>;
}

function allowedSections(company: Company): Section[] {
  if (company.role === 'EMPLOYEE') return ['calendar', 'appointments', 'schedule'];
  const common: Section[] = ['dashboard', 'analytics', 'calendar', 'appointments', 'customers', 'reviews', 'services', 'employees', 'schedule', 'bot', 'members', 'settings', 'audit'];
  return company.role === 'OWNER' ? [...common, 'billing'] : common;
}
