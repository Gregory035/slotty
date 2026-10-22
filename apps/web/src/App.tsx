import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { trackPageView } from './analytics';
import { LoadingBlock } from './components/ui';
import { isPublicPath, syncSeo } from './seo';
import { LandingPage } from './views/LandingPage';
import { OnlineBookingPage } from './views/OnlineBookingPage';
import { TelegramBookingPage } from './views/TelegramBookingPage';
import { NotFoundPage } from './views/NotFoundPage';
import { LegalPage } from './views/LegalPage';
import { MasterBookingPage, SalonBookingPage } from './views/AudiencePages';

const WorkspaceApp = lazy(() => import('./WorkspaceApp').then((module) => ({ default: module.WorkspaceApp })));
const TelegramMiniAppPage = lazy(() => import('./views/TelegramMiniAppPage').then((module) => ({ default: module.TelegramMiniAppPage })));
const PublicCompanyPage = lazy(() => import('./views/PublicCompanyPage').then((module) => ({ default: module.PublicCompanyPage })));

export function App() {
  const location = useLocation();

  useEffect(() => {
    syncSeo(location.pathname);
    if (isPublicPath(location.pathname)) trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/online-zapis" element={<OnlineBookingPage />} />
      <Route path="/zapis-cherez-telegram" element={<TelegramBookingPage />} />
      <Route path="/dlya-mastera" element={<MasterBookingPage />} />
      <Route path="/dlya-salona" element={<SalonBookingPage />} />
      <Route path="/privacy" element={<LegalPage document="privacy" />} />
      <Route path="/terms" element={<LegalPage document="terms" />} />
      <Route path="/personal-data" element={<LegalPage document="consent" />} />
      <Route path="/offer" element={<LegalPage document="offer" />} />
      <Route path="/cookies" element={<LegalPage document="cookies" />} />
      <Route path="/data-processing" element={<LegalPage document="processing" />} />
      <Route path="/company/:slug" element={<WorkspaceFallback><PublicCompanyPage /></WorkspaceFallback>} />
      <Route path="/miniapp/:companyId" element={<WorkspaceFallback><TelegramMiniAppPage /></WorkspaceFallback>} />
      <Route path="/app/*" element={<WorkspaceFallback><WorkspaceApp /></WorkspaceFallback>} />
      <Route path="/companies/:companyId/:section/*" element={<WorkspaceFallback><WorkspaceApp /></WorkspaceFallback>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function WorkspaceFallback({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="fullscreen-state"><LoadingBlock label="Открываем Slotty" /></div>}>{children}</Suspense>;
}
