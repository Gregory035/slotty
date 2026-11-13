import type { Metric } from 'web-vitals';
import { analyticsConsent } from './analytics';

const publicPaths = new Set(['/', '/online-zapis', '/zapis-cherez-telegram', '/dlya-mastera', '/dlya-salona']);
let initialized = false;

export function initializeWebVitals(): void {
  if (
    initialized ||
    analyticsConsent() !== 'granted' ||
    navigator.doNotTrack === '1' ||
    !publicPaths.has(window.location.pathname)
  ) return;
  initialized = true;
  const path = window.location.pathname;
  const endpoint = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'}/telemetry/web-vitals`;
  const report = (metric: Metric) => {
    // Consent may be withdrawn, or a public visit may continue into the cabinet.
    if (analyticsConsent() !== 'granted' || navigator.doNotTrack === '1' || window.location.pathname !== path) return;
    const payload = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      path,
      navigationType: metric.navigationType,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
      return;
    }
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  };

  void import('web-vitals').then(({ onCLS, onINP, onLCP }) => {
    onCLS(report);
    onINP(report);
    onLCP(report);
  }).catch(() => { initialized = false; });
}
