import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompanies } from './api';
import { AppShell } from './components/AppShell';
import { AuthScreen } from './components/AuthScreen';
import { CompanyOnboarding } from './components/CompanyOnboarding';
import { ErrorBlock, LoadingBlock } from './components/ui';
import { useAppStore } from './store';
import { AppointmentsView } from './views/AppointmentsView';
import { BotView } from './views/BotView';
import { EmployeesView } from './views/EmployeesView';
import { OverviewView } from './views/OverviewView';
import { ServicesView } from './views/ServicesView';

export function App() {
  const session = useAppStore((state) => state.session);
  const section = useAppStore((state) => state.section);
  const activeCompanyId = useAppStore((state) => state.activeCompanyId);
  const setActiveCompanyId = useAppStore((state) => state.setActiveCompanyId);
  const setSession = useAppStore((state) => state.setSession);
  const companies = useQuery({
    queryKey: ['companies', session?.user.id],
    queryFn: getCompanies,
    enabled: Boolean(session),
  });

  useEffect(() => {
    const expire = () => setSession(null);
    window.addEventListener('auth-expired', expire);
    return () => window.removeEventListener('auth-expired', expire);
  }, [setSession]);

  useEffect(() => {
    if (!companies.data?.length) return;
    if (!activeCompanyId || !companies.data.some((item) => item.id === activeCompanyId)) {
      setActiveCompanyId(companies.data[0]!.id);
    }
  }, [activeCompanyId, companies.data, setActiveCompanyId]);

  if (!session) return <AuthScreen />;
  if (companies.isLoading) return <div className="fullscreen-state"><LoadingBlock label="Открываем рабочее пространство" /></div>;
  if (companies.error) return <div className="fullscreen-state"><ErrorBlock message="Не удалось загрузить компании. Убедитесь, что API запущен." /></div>;
  if (!companies.data?.length) return <CompanyOnboarding />;

  const activeCompany = companies.data.find((item) => item.id === activeCompanyId) ?? companies.data[0]!;
  const content = {
    overview: <OverviewView company={activeCompany} />,
    appointments: <AppointmentsView company={activeCompany} />,
    services: <ServicesView company={activeCompany} />,
    employees: <EmployeesView company={activeCompany} />,
    bot: <BotView company={activeCompany} />,
  }[section];

  return <AppShell companies={companies.data} activeCompany={activeCompany}>{content}</AppShell>;
}
