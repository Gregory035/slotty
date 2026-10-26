import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { AnalyticsConsent } from './components/AnalyticsConsent';
import './public.css';
import { initializeWebVitals } from './web-vitals';

const application = (
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <ToastProvider><App /><AnalyticsConsent /></ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);

async function bootstrap() {
  if (window.location.pathname.startsWith('/miniapp/')) await loadTelegramSdk();
  const root = document.getElementById('root')!;
  if (root.hasChildNodes()) hydrateRoot(root, application);
  else createRoot(root).render(application);
  initializeWebVitals();
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => undefined);
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
      }
    });
  }
}

async function loadTelegramSdk(): Promise<void> {
  if ((window as Window & { Telegram?: unknown }).Telegram) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    script.onload = finish;
    script.onerror = finish;
    const timeout = window.setTimeout(finish, 5000);
    document.head.append(script);
  });
}

void bootstrap();
