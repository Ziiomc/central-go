const CACHE_NAME = 'centralgo-official-v5-stable';

// No usamos skipWaiting(): una versión nueva no debe tomar control de una
// sesión de conductor que está abierta o suspendida en segundo plano.
self.addEventListener('install', () => {
  // El navegador dejará este worker en waiting hasta que corresponda activarlo
  // de forma natural, evitando controllerchange durante una carrera viva.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith('centralgo-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ),
    ),
  );

  // Tampoco usamos clients.claim(). El nuevo worker controlará documentos en
  // una navegación futura, no una pestaña/PWA que el conductor acaba de reabrir.
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Central GO prioriza datos y frontend actuales. El Service Worker no sirve
  // bundles antiguos desde Cache Storage y no provoca navegaciones/reloads.
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});
