import { requireSupabase } from './supabase';

// PWA Registration & Install helper

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenersRegistered = false;
let serviceWorkerRegistrationStarted = false;
let controllerListenerRegistered = false;
let serviceWorkerMessageListenerRegistered = false;
let driverReliabilityRegistered = false;
let driverPushRegistered = false;
let driverSessionReliabilityRegistered = false;
let driverSessionRefreshPromise: Promise<void> | null = null;
let driverSessionInterval: number | null = null;
let driverSessionHiddenAt: number | null = null;
let driverWakeLock: WakeLockSentinelLike | null = null;
let driverWakeLockBusy = false;
let driverHiddenAt: number | null = null;
const FRESHNESS_KEY = 'centralgo-fresh-bundle-v10-stale-chunk-recovery';
const DRIVER_PUSH_PROMPTED_KEY = 'centralgo-driver-push-prompted';
const DRIVER_RESUME_THRESHOLD_MS = 8000;
const DRIVER_SESSION_FORCE_REFRESH_AFTER_MS = 60_000;
const DRIVER_SESSION_REFRESH_MARGIN_MS = 12 * 60_000;
const DRIVER_SESSION_CHECK_MS = 4 * 60_000;
const VAPID_PUBLIC_KEY = 'BEN4b02sauQecZUH30sIRi_tubjuPEmL9sWmvFgmwgJLKIvEj1DtDdAfff4xbYi3nCvgfB0p40R-IIdE0aEGwys';

const isDriverRoute = () => typeof window !== 'undefined' && location.pathname.startsWith('/driver');

const vapidToUint8 = (value: string) => {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
};

async function maintainDriverSession(forceRefresh = false) {
  if (!isDriverRoute() || !navigator.onLine) return;
  if (driverSessionRefreshPromise) return driverSessionRefreshPromise;

  driverSessionRefreshPromise = (async () => {
    try {
      const db = requireSupabase();
      const { data, error } = await db.auth.getSession();
      if (error || !data.session) return;
      const expiresAtMs = Number(data.session.expires_at ?? 0) * 1000;
      const nearExpiry = !expiresAtMs || expiresAtMs - Date.now() <= DRIVER_SESSION_REFRESH_MARGIN_MS;
      if (!forceRefresh && !nearExpiry) return;
      const { error: refreshError } = await db.auth.refreshSession();
      if (refreshError) console.warn('CentralGo driver session refresh deferred:', refreshError.message);
    } catch (error) {
      // Mobile networks frequently disappear for a few seconds after unlock.
      // A temporary transport error must never force the driver out of the app.
      console.warn('CentralGo driver session recovery pending:', error);
    }
  })().finally(() => { driverSessionRefreshPromise = null; });

  return driverSessionRefreshPromise;
}

function registerDriverSessionReliability() {
  if (typeof window === 'undefined' || driverSessionReliabilityRegistered || !isDriverRoute()) return;
  driverSessionReliabilityRegistered = true;

  const recover = (force = false) => {
    if (!isDriverRoute() || document.visibilityState !== 'visible') return;
    void maintainDriverSession(force).finally(() => {
      window.dispatchEvent(new CustomEvent('centralgo:driver-resync', { detail: { reason: 'session-recovery' } }));
    });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      driverSessionHiddenAt = Date.now();
      return;
    }
    const hiddenMs = driverSessionHiddenAt ? Date.now() - driverSessionHiddenAt : 0;
    driverSessionHiddenAt = null;
    recover(hiddenMs >= DRIVER_SESSION_FORCE_REFRESH_AFTER_MS);
  });
  window.addEventListener('pageshow', (event) => recover((event as PageTransitionEvent).persisted));
  window.addEventListener('online', () => recover(true));
  window.addEventListener('focus', () => recover(false));

  driverSessionInterval = window.setInterval(() => {
    if (document.visibilityState === 'visible') void maintainDriverSession(false);
  }, DRIVER_SESSION_CHECK_MS);

  void maintainDriverSession(false);
}

async function ensureDriverPushSubscription(requestPermission: boolean) {
  if (!isDriverRoute()) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return false;

  let permission = Notification.permission;
  if (requestPermission && permission === 'default') {
    permission = await Notification.requestPermission();
    localStorage.setItem(DRIVER_PUSH_PROMPTED_KEY, '1');
  }
  if (permission !== 'granted') return false;

  await maintainDriverSession(false);
  const db = requireSupabase();
  const { data: authData } = await db.auth.getUser();
  if (!authData.user) return false;
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidToUint8(VAPID_PUBLIC_KEY) });
  }
  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys.auth) return false;
  const { error } = await db.from('driver_push_subscriptions').upsert({
    user_id: authData.user.id,
    endpoint: subscription.endpoint,
    p256dh: json.keys.p256dh,
    auth_key: json.keys.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw error;
  localStorage.setItem(DRIVER_PUSH_PROMPTED_KEY, '1');
  window.dispatchEvent(new CustomEvent('centralgo-driver-push-ready'));
  return true;
}

async function purgeLegacyFrontendCaches() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(FRESHNESS_KEY) === '1') return;
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith('centralgo-')).map((name) => caches.delete(name)));
    }
    localStorage.setItem(FRESHNESS_KEY, '1');
  } catch (error) {
    console.warn('CentralGo cache purge failed:', error);
  }
}

function registerInstallListeners() {
  if (typeof window === 'undefined' || listenersRegistered) return;
  listenersRegistered = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('pwa-installable'));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
}

function registerControllerListener() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || controllerListenerRegistered) return;
  controllerListenerRegistered = true;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.dispatchEvent(new CustomEvent('centralgo-sw-updated'));
  });
}

function registerServiceWorkerMessageListener() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || serviceWorkerMessageListenerRegistered) return;
  serviceWorkerMessageListenerRegistered = true;

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string; tripId?: string | null; status?: string | null } | undefined;
    if (!data?.type || !['centralgo:trip-cancelled', 'centralgo:trip-cleared'].includes(data.type)) return;

    try { if ('vibrate' in navigator) navigator.vibrate(0); } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
    window.dispatchEvent(new CustomEvent('centralgo:driver-resync', { detail: { reason: data.type, tripId: data.tripId } }));

    // React receives the normal Realtime update. A reload is only needed when an
    // unanswered offer was withdrawn/cancelled, because the browser may have suspended
    // the component while that offer was on screen. Accepting a trip (en_route) must not reload.
    const shouldReload = isDriverRoute() && (data.type === 'centralgo:trip-cancelled' || data.status !== 'en_route');
    if (!shouldReload) return;

    const key = `centralgo:driver-trip-clear:${data.tripId || 'unknown'}`;
    const previous = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - previous < 5000) return;
    sessionStorage.setItem(key, String(Date.now()));
    window.setTimeout(() => window.location.reload(), 180);
  });
}

function registerDriverPush() {
  if (typeof window === 'undefined' || driverPushRegistered || !isDriverRoute()) return;
  driverPushRegistered = true;

  // Si ya se concedió permiso, restauramos/renovamos la suscripción sin molestar al conductor.
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    void ensureDriverPushSubscription(false).catch((error) => console.warn('CentralGo push restore failed:', error));
    return;
  }

  // Android exige que el permiso se solicite desde una interacción del usuario.
  // Aprovechamos la primera acción dentro de la app (estado, GPS, radio, etc.).
  const activateFromGesture = () => {
    window.removeEventListener('pointerdown', activateFromGesture, true);
    if (localStorage.getItem(DRIVER_PUSH_PROMPTED_KEY) === '1') return;
    void ensureDriverPushSubscription(true).catch((error) => console.warn('CentralGo push activation failed:', error));
  };
  window.addEventListener('pointerdown', activateFromGesture, true);
}

async function releaseDriverWakeLock() {
  const current = driverWakeLock;
  driverWakeLock = null;
  if (!current || current.released) return;
  try { await current.release(); } catch {}
}

async function requestDriverWakeLock() {
  if (!isDriverRoute()) return;
  if (!/Android/i.test(navigator.userAgent || '')) return;
  if (document.visibilityState !== 'visible') return;
  if (localStorage.getItem('centralgo-driver-gps-wanted') === '0') return;
  const nav = navigator as NavigatorWithWakeLock;
  if (!nav.wakeLock?.request || driverWakeLock || driverWakeLockBusy) return;
  driverWakeLockBusy = true;
  try {
    const sentinel = await nav.wakeLock.request('screen');
    driverWakeLock = sentinel;
    sentinel.addEventListener?.('release', () => { if (driverWakeLock === sentinel) driverWakeLock = null; });
  } catch {} finally { driverWakeLockBusy = false; }
}

function recoverDriverAfterAndroidSuspend(force = false) {
  if (!isDriverRoute() || !/Android/i.test(navigator.userAgent || '')) return;
  if (document.visibilityState !== 'visible') return;
  void requestDriverWakeLock();

  const hiddenAt = driverHiddenAt;
  driverHiddenAt = null;
  const suspendedMs = hiddenAt ? Date.now() - hiddenAt : 0;
  const needsStrongRecovery = force || suspendedMs >= DRIVER_RESUME_THRESHOLD_MS;

  void maintainDriverSession(needsStrongRecovery).finally(() => {
    void ensureDriverPushSubscription(false).catch(() => undefined);
  });

  if (!needsStrongRecovery) return;
  // No recargamos la página al volver normalmente: el proveedor restaura la copia local
  // y luego reconcilia el estado autoritativo con Supabase.
  window.dispatchEvent(new CustomEvent('centralgo:driver-resync',{detail:{suspendedMs}}));
}

function registerDriverAndroidReliability() {
  if (typeof window === 'undefined' || driverReliabilityRegistered) return;
  if (!isDriverRoute() || !/Android/i.test(navigator.userAgent || '')) return;
  driverReliabilityRegistered = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { driverHiddenAt = Date.now(); void releaseDriverWakeLock(); return; }
    recoverDriverAfterAndroidSuspend();
  });
  window.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) recoverDriverAfterAndroidSuspend(true);
    else void requestDriverWakeLock();
  });
  window.addEventListener('online', () => recoverDriverAfterAndroidSuspend(true));
  window.addEventListener('focus', () => { if (driverHiddenAt) recoverDriverAfterAndroidSuspend(); else void requestDriverWakeLock(); });
  void requestDriverWakeLock();
}

async function doRegisterServiceWorker() {
  if (serviceWorkerRegistrationStarted || !('serviceWorker' in navigator)) return;
  serviceWorkerRegistrationStarted = true;
  try {
    await purgeLegacyFrontendCaches();
    const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    // Pedimos comprobar la versión para que los dispositivos existentes reciban el worker con el ciclo de vida de ofertas.
    void registration.update().catch(() => undefined);
    console.log('CentralGo ServiceWorker registered:', registration.scope);
    registerDriverPush();
  } catch (error) {
    serviceWorkerRegistrationStarted = false;
    console.warn('CentralGo ServiceWorker registration failed:', error);
  }
}

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  registerInstallListeners();
  registerControllerListener();
  registerServiceWorkerMessageListener();
  registerDriverSessionReliability();
  registerDriverAndroidReliability();
  if (!('serviceWorker' in navigator)) return;
  if (document.readyState === 'complete') void doRegisterServiceWorker();
  else window.addEventListener('load', () => void doRegisterServiceWorker(), { once: true });
}

export async function promptPWAInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const promptEvent = deferredPrompt;
  await promptEvent.prompt();
  const choiceResult = await promptEvent.userChoice;
  deferredPrompt = null;
  return choiceResult.outcome === 'accepted';
}

export function isPWAInstallPromptAvailable(): boolean { return Boolean(deferredPrompt); }
