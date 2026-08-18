const CACHE_NAME = 'centralgo-official-v10-stale-chunk-recovery';

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

const closeTripNotifications = async (tripId) => {
  if (!tripId) return;
  const notifications = await self.registration.getNotifications();
  for (const notification of notifications) {
    const sameTrip = notification.data?.tripId === tripId || notification.tag === `trip-${tripId}`;
    if (sameTrip) notification.close();
  }
};

const messageDriverClients = async (message) => {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) {
    try { client.postMessage(message); } catch {}
  }
  return windows;
};

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { title: 'Nueva carrera · Central GO', body: event.data?.text() || 'Tienes una nueva carrera.', kind: 'trip' }; }

  const tripId = payload.tripId || null;
  const kind = payload.kind || 'alert';

  if (kind === 'trip_cancelled' || kind === 'trip_cleared') {
    event.waitUntil((async () => {
      await closeTripNotifications(tripId);
      await messageDriverClients({
        type: kind === 'trip_cancelled' ? 'centralgo:trip-cancelled' : 'centralgo:trip-cleared',
        tripId,
        status: payload.status || null,
        body: payload.body || '',
      });

      // Una cancelación debe informarse, pero jamás continuar sonando ni vibrando.
      if (kind === 'trip_cancelled') {
        await self.registration.showNotification(payload.title || 'Carrera cancelada · Central GO', {
          body: payload.body || 'La central canceló esta carrera.',
          tag: `trip-cancelled-${tripId || Date.now()}`,
          renotify: false,
          silent: true,
          timestamp: Date.now(),
          requireInteraction: false,
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          lang: 'es-CL',
          data: { url: payload.url || '/driver', tripId, kind },
          actions: [{ action: 'open', title: 'Abrir Central GO' }],
        });
      }
    })());
    return;
  }

  const isTrip = kind === 'trip' || Boolean(tripId);
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
    data: { url: payload.url || '/driver', tripId, kind },
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
