import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { seoPages, structuredDataForPath } from './seo';

export { seoPages };

export function renderPage(pathname: string): string {
  return renderToString(<StaticRouter location={pathname}><ErrorBoundary><ToastProvider><App /></ToastProvider></ErrorBoundary></StaticRouter>);
}

export const structuredData = structuredDataForPath;
