type AnalyticsEventParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
    ym?: (counterId: number, action: string, ...args: unknown[]) => void;
  }
}

const gaId = (import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
const ymId = Number.parseInt((import.meta.env.VITE_YM_COUNTER_ID ?? '').trim(), 10);
const consentKey = 'slotty-analytics-consent';
let initialized = false;
let lastPageView: string | null = null;

export const hasAnalyticsConfiguration = Boolean(/^G-[A-Z0-9]+$/i.test(gaId) || Number.isInteger(ymId));

export function analyticsConsent(): 'granted' | 'denied' | null {
  const value = localStorage.getItem(consentKey);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function setAnalyticsConsent(value: 'granted' | 'denied') {
  localStorage.setItem(consentKey, value);
}

function appendScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.append(script);
}

export function initializeAnalytics() {
  if (initialized || analyticsConsent() !== 'granted' || navigator.doNotTrack === '1') return;
  initialized = true;

  if (/^G-[A-Z0-9]+$/i.test(gaId)) {
    appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`);
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = (...args) => { window.dataLayer?.push(args); };
    window.gtag('js', new Date());
    window.gtag('config', gaId, { anonymize_ip: true, send_page_view: false });
  }

  if (Number.isInteger(ymId)) {
    appendScript('https://mc.yandex.ru/metrika/tag.js');
    window.ym = window.ym ?? (() => undefined);
    // SPA сама отправляет просмотры через trackPageView. Без defer Метрика
    // дополнительно засчитает автоматический первый просмотр при инициализации.
    window.ym(ymId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false, defer: true });
  }
}

export function trackPageView(pathname: string) {
  if (analyticsConsent() !== 'granted' || navigator.doNotTrack === '1') return;
  initializeAnalytics();
  const pagePath = pathname.split('?')[0] || '/';
  if (pagePath === lastPageView) return;
  lastPageView = pagePath;
  if (/^G-[A-Z0-9]+$/i.test(gaId)) window.gtag?.('event', 'page_view', { page_path: pagePath });
  if (Number.isInteger(ymId)) window.ym?.(ymId, 'hit', pagePath);
}

export function trackEvent(name: string, params: AnalyticsEventParams = {}) {
  if (analyticsConsent() !== 'granted' || navigator.doNotTrack === '1') return;
  initializeAnalytics();
  if (/^G-[A-Z0-9]+$/i.test(gaId)) window.gtag?.('event', name, params);
  if (Number.isInteger(ymId)) window.ym?.(ymId, 'reachGoal', name, params);
}
