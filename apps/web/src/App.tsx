import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { trackPageView } from './analytics';
import { LoadingBlock } from './components/ui';
import { isPublicPath, syncSeo } from './seo';
import { LandingPage } from './views/LandingPage';
import { OnlineBookingPage } from './views/OnlineBookingPage';
import { TelegramBookingPage } from './views/TelegramBookingPage';
import { NotFoundPage } from './views/NotFoundPage';

const WorkspaceApp = lazy(() => import('./WorkspaceApp').then((module) => ({ default: module.WorkspaceApp })));

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
      <Route path="/app/*" element={<WorkspaceFallback><WorkspaceApp /></WorkspaceFallback>} />
      <Route path="/companies/:companyId/:section/*" element={<WorkspaceFallback><WorkspaceApp /></WorkspaceFallback>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function WorkspaceFallback({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="fullscreen-state"><LoadingBlock label="Открываем Slotty" /></div>}>{children}</Suspense>;
}
