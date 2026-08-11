const CACHE_NAME = 'centralgo-official-v4-fresh';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Durante la etapa de implementación comercial no servimos bundles viejos
  // desde Cache Storage. Cada navegación, JS, CSS y asset se valida contra red.
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});
