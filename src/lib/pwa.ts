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
let driverReliabilityRegistered = false;
let driverPushRegistered = false;
let driverWakeLock: WakeLockSentinelLike | null = null;
let driverWakeLockBusy = false;
let driverHiddenAt: number | null = null;
const FRESHNESS_KEY = 'centralgo-fresh-bundle-v8-push';
const DRIVER_PUSH_PROMPTED_KEY = 'centralgo-driver-push-prompted';
const DRIVER_RESUME_THRESHOLD_MS = 8000;
const VAPID_PUBLIC_KEY = 'BEN4b02sauQecZUH30sIRi_tubjuPEmL9sWmvFgmwgJLKIvEj1DtDdAfff4xbYi3nCvgfB0p40R-IIdE0aEGwys';

const vapidToUint8 = (value: string) => {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
};

async function ensureDriverPushSubscription(requestPermission: boolean) {
  if (!location.pathname.startsWith('/driver')) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return false;

  let permission = Notification.permission;
  if (requestPermission && permission === 'default') {
    permission = await Notification.requestPermission();
    localStorage.setItem(DRIVER_PUSH_PROMPTED_KEY, '1');
  }
  if (permission !== 'granted') return false;

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

function registerDriverPush() {
  if (typeof window === 'undefined' || driverPushRegistered || !location.pathname.startsWith('/driver')) return;
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
  if (!location.pathname.startsWith('/driver')) return;
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
  if (!location.pathname.startsWith('/driver') || !/Android/i.test(navigator.userAgent || '')) return;
  if (document.visibilityState !== 'visible') return;
  void requestDriverWakeLock();
  void ensureDriverPushSubscription(false).catch(() => undefined);

  const hiddenAt = driverHiddenAt;
  driverHiddenAt = null;
  const suspendedMs = hiddenAt ? Date.now() - hiddenAt : 0;
  if (!force && suspendedMs < DRIVER_RESUME_THRESHOLD_MS) return;
  // No recargamos la página: una recarga puede borrar la pantalla de la carrera
  // mientras la red móvil vuelve. El proveedor restaura la copia local y luego
  // reconcilia el estado autoritativo con Supabase.
  window.dispatchEvent(new CustomEvent('centralgo:driver-resync',{detail:{suspendedMs}}));
}

function registerDriverAndroidReliability() {
  if (typeof window === 'undefined' || driverReliabilityRegistered) return;
  if (!location.pathname.startsWith('/driver') || !/Android/i.test(navigator.userAgent || '')) return;
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
    // Pedimos comprobar la versión para que los dispositivos existentes reciban el worker con Push.
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
export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true;
}
