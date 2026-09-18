export interface SeoPageDefinition {
  path: '/' | '/online-zapis' | '/zapis-cherez-telegram';
  title: string;
  description: string;
  ogImage: string;
}

export const seoPages: readonly SeoPageDefinition[] = [
  { path: '/', title: 'Slotty — сервис онлайн-записи клиентов через Telegram', description: 'Slotty помогает бизнесу услуг принимать онлайн-записи через Telegram, управлять расписанием, сотрудниками и клиентами в одной системе.', ogImage: '/og/slotty-online-booking.png' },
  { path: '/online-zapis', title: 'Онлайн-запись клиентов для бизнеса — Slotty', description: 'Система онлайн-записи Slotty: услуги, сотрудники, свободные слоты, напоминания, лист ожидания, отзывы и аналитика для бизнеса услуг.', ogImage: '/og/slotty-online-booking.png' },
  { path: '/zapis-cherez-telegram', title: 'Онлайн-запись клиентов через Телеграм — Slotty', description: 'Онлайн-запись через Telegram-бота Slotty: выбор услуги, специалиста и свободного времени, перенос и отмена визита. Расписание и клиенты в одной панели.', ogImage: '/og/slotty-telegram-booking.png' },
] as const;

export function normalizePath(pathname: string): string {
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '');
}

export function seoPage(pathname: string): SeoPageDefinition | undefined {
  return seoPages.find((page) => page.path === normalizePath(pathname));
}

export function isPublicPath(pathname: string): boolean {
  return Boolean(seoPage(pathname));
}

export function structuredDataForPath(pathname: string, origin: string): object[] {
  const normalizedPath = normalizePath(pathname);
  if (normalizedPath === '/') {
    return [
      { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${origin}/#website`, url: `${origin}/`, name: 'Slotty', inLanguage: 'ru-RU', description: seoPages[0]!.description },
      { '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': `${origin}/#software`, name: 'Slotty', url: `${origin}/`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'ru-RU', description: seoPages[0]!.description },
    ];
  }
  const current = seoPage(normalizedPath);
  return current ? [{
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: normalizedPath === '/online-zapis' ? 'Онлайн-запись' : 'Запись через Telegram', item: `${origin}${normalizedPath}` },
    ],
  }] : [];
}

function setMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.append(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

function setCanonical(url: string | null) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!url) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.append(element);
  }
  element.href = url;
}

function syncStructuredData(pathname: string, origin: string | null) {
  document.head.querySelectorAll('script[type="application/ld+json"][data-slotty-seo]').forEach((element) => element.remove());
  if (!origin) return;
  const schemas = structuredDataForPath(pathname, origin);
  if (!schemas.length) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.slottySeo = 'true';
  script.textContent = JSON.stringify(schemas);
  document.head.append(script);
}

export function syncSeo(pathname: string) {
  const page = seoPage(pathname);
  const indexingEnabled = import.meta.env.VITE_SEO_INDEXING_ENABLED === 'true';
  const configuredOrigin = (import.meta.env.VITE_SITE_URL ?? '').replace(/\/$/, '');
  const canonical = page && indexingEnabled && configuredOrigin ? `${configuredOrigin}${page.path}` : null;
  const isPrivate = pathname.startsWith('/app') || pathname.startsWith('/companies/');
  const title = page?.title ?? (isPrivate ? 'Slotty — рабочее пространство' : 'Страница не найдена — Slotty');
  const description = page?.description ?? (isPrivate ? 'Рабочее пространство Slotty.' : 'Запрошенная страница не найдена.');

  document.title = title;
  document.documentElement.lang = 'ru';
  setMeta('meta[name="description"]', { name: 'description', content: description });
  setMeta('meta[name="robots"]', { name: 'robots', content: page && indexingEnabled ? 'index,follow,max-image-preview:large' : 'noindex,nofollow' });
  setCanonical(canonical);
  syncStructuredData(pathname, canonical ? configuredOrigin : null);

  if (page && canonical) {
    const image = `${configuredOrigin}${page.ogImage}`;
    setMeta('meta[property="og:title"]', { property: 'og:title', content: page.title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: page.description });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    setMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'ru_RU' });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: 'Slotty — онлайн-запись через Telegram' });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: page.title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: page.description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
  } else {
    document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((element) => element.remove());
  }

  document.head.querySelector('meta[name="keywords"]')?.remove();
}
