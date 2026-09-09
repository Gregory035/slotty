const publicTitle = 'Slotty — онлайн-запись через Telegram для малого бизнеса';
const publicDescription = 'Slotty помогает малому бизнесу принимать онлайн-записи через Telegram, вести расписание, клиентов и команду в одной системе.';

function setMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.append(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.append(element);
  }
  element.href = url;
}

export function syncSeo(pathname: string) {
  const isLanding = pathname === '/';
  const title = isLanding ? publicTitle : 'Slotty — система записи';
  const description = isLanding ? publicDescription : 'Рабочее пространство Slotty.';
  const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');

  document.title = title;
  document.documentElement.lang = 'ru';
  setMeta('meta[name="description"]', { name: 'description', content: description });
  setMeta('meta[name="robots"]', { name: 'robots', content: isLanding ? 'index,follow,max-image-preview:large' : 'noindex,nofollow' });
  setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  setMeta('meta[property="og:type"]', { property: 'og:type', content: isLanding ? 'website' : 'website' });
  setMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'ru_RU' });
  setMeta('meta[property="og:url"]', { property: 'og:url', content: `${siteUrl}${isLanding ? '/' : pathname}` });
  setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
  setCanonical(`${siteUrl}${isLanding ? '/' : pathname}`);
}
