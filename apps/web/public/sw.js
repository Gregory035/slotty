const CACHE = 'slotty-shell-v6';
const SHELL = [
  '/',
  '/app',
  '/site.webmanifest',
  '/brand/slotty-icon-dark.svg',
  '/brand/slotty-logo-horizontal-dark.svg',
  '/fonts/onest-cyrillic.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match('/app'))));
    return;
  }
  if (!url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/fonts/') && !url.pathname.startsWith('/brand/')) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) void caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Slotty', body: 'У вас новое уведомление', url: '/app' };
  try { payload = { ...payload, ...event.data?.json() }; } catch { /* use safe defaults */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/brand/slotty-icon-192.png',
    badge: '/brand/slotty-badge-96.png',
    ...(payload.tag ? { tag: payload.tag } : {}),
    data: { url: payload.url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app';
  const target = new URL(url, self.location.origin);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients[0];
    if (!existing) return self.clients.openWindow(target.href);
    return existing.navigate(target.href).then((client) => client?.focus());
  }));
});
