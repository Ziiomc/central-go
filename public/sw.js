const CACHE_NAME = 'centralgo-official-v8-priority-push';

self.addEventListener('install', () => {});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('centralgo-') && name !== CACHE_NAME).map((name) => caches.delete(name)))),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith('/__supabase')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (response.ok && response.type === 'basic') void cache.put(event.request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return (await cache.match('/driver')) || (await cache.match('/')) || Response.error();
      return Response.error();
    }
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { title: 'Nueva carrera · Central GO', body: event.data?.text() || 'Tienes una nueva carrera.', kind: 'trip' }; }
  const isTrip = payload.kind === 'trip' || Boolean(payload.tripId);
  const title = payload.title || (isTrip ? 'Nueva carrera · Central GO' : 'Central GO');
  const options = {
    body: payload.body || 'Abre Central GO para revisar el despacho.',
    tag: payload.tag || `${isTrip ? 'centralgo-trip' : 'centralgo-alert'}-${Date.now()}`,
    renotify: true,
    silent: false,
    timestamp: Date.now(),
    requireInteraction: isTrip,
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    vibrate: isTrip ? [400, 100, 400, 100, 650, 120, 650] : [240, 100, 380],
    lang: 'es-CL',
    data: { url: payload.url || '/driver', tripId: payload.tripId || null, kind: payload.kind || 'alert' },
    actions: [{ action: 'open', title: isTrip ? 'Abrir carrera' : 'Abrir Central GO' }],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || '/driver';
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        try { await client.navigate(target); } catch {}
        return client.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(target);
  })());
});
