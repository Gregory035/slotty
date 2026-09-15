import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { AnalyticsConsent } from './components/AnalyticsConsent';
import './public.css';

const application = (
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <ToastProvider><App /><AnalyticsConsent /></ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);

const root = document.getElementById('root')!;
if (root.hasChildNodes()) hydrateRoot(root, application);
else createRoot(root).render(application);
