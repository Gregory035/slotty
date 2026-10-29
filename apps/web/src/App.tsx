import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { trackPageView } from './analytics';
import { LoadingBlock } from './components/ui';
import { isPublicPath, syncSeo } from './seo';
import { LandingPage } from './views/LandingPage';
import { OnlineBookingPage as StaticOnlineBookingPage } from './views/OnlineBookingPage';
import { TelegramBookingPage as StaticTelegramBookingPage } from './views/TelegramBookingPage';
import { NotFoundPage } from './views/NotFoundPage';
import { LegalPage as StaticLegalPage } from './views/LegalPage';
import { MasterBookingPage as StaticMasterBookingPage, SalonBookingPage as StaticSalonBookingPage } from './views/AudiencePages';

// Prerender stays synchronous; the browser only downloads the requested page.
const OnlineBookingPage = import.meta.env.SSR ? StaticOnlineBookingPage : lazy(() => import('./views/OnlineBookingPage').then((module) => ({ default: module.OnlineBookingPage })));
const TelegramBookingPage = import.meta.env.SSR ? StaticTelegramBookingPage : lazy(() => import('./views/TelegramBookingPage').then((module) => ({ default: module.TelegramBookingPage })));
const MasterBookingPage = import.meta.env.SSR ? StaticMasterBookingPage : lazy(() => import('./views/AudiencePages').then((module) => ({ default: module.MasterBookingPage })));
const SalonBookingPage = import.meta.env.SSR ? StaticSalonBookingPage : lazy(() => import('./views/AudiencePages').then((module) => ({ default: module.SalonBookingPage })));

const WorkspaceApp = lazy(() => import('./WorkspaceApp').then((module) => ({ default: module.WorkspaceApp })));
const DeferredLegalPage = import.meta.env.SSR ? StaticLegalPage : lazy(() => import('./views/LegalPage').then((module) => ({ default: module.LegalPage })));
const LegalPage: typeof StaticLegalPage = (props) => (
  <Suspense fallback={<div className="fullscreen-state"><LoadingBlock label="Открываем документ" /></div>}>
    <DeferredLegalPage {...props} />
  </Suspense>
);
const TelegramMiniAppPage = lazy(() => import('./views/TelegramMiniAppPage').then((module) => ({ default: module.TelegramMiniAppPage })));
const PublicCompanyPage = lazy(() => import('./views/PublicCompanyPage').then((module) => ({ default: module.PublicCompanyPage })));

export function App() {
  const location = useLocation();

  useEffect(() => {
    syncSeo(location.pathname);
    if (isPublicPath(location.pathname)) trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <Suspense fallback={<div className="fullscreen-state"><LoadingBlock label="Открываем страницу" /></div>}><Routes>
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
    </Routes></Suspense>
  );
}

function WorkspaceFallback({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="fullscreen-state"><LoadingBlock label="Открываем Slotty" /></div>}>{children}</Suspense>;
}
