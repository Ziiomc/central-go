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
let driverWakeLock: WakeLockSentinelLike | null = null;
let driverWakeLockBusy = false;
let driverHiddenAt: number | null = null;
const FRESHNESS_KEY = 'centralgo-fresh-bundle-v7';
const DRIVER_RESUME_RELOAD_KEY = 'centralgo-driver-last-auto-resume-reload';
const DRIVER_RESUME_THRESHOLD_MS = 8000;
const DRIVER_RELOAD_GUARD_MS = 12000;

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

  // Nunca recargamos la aplicación por cambios del Service Worker. La sesión
  // del conductor debe sobrevivir a cambio de app, bloqueo de pantalla y resume.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.dispatchEvent(new CustomEvent('centralgo-sw-updated'));
  });
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
    sentinel.addEventListener?.('release', () => {
      if (driverWakeLock === sentinel) driverWakeLock = null;
    });
  } catch {
    // Algunos fabricantes o modos de ahorro de energía no permiten Wake Lock.
  } finally {
    driverWakeLockBusy = false;
  }
}

function recoverDriverAfterAndroidSuspend(force = false) {
  if (!location.pathname.startsWith('/driver') || !/Android/i.test(navigator.userAgent || '')) return;
  if (document.visibilityState !== 'visible') return;
  void requestDriverWakeLock();

  const hiddenAt = driverHiddenAt;
  driverHiddenAt = null;
  const suspendedMs = hiddenAt ? Date.now() - hiddenAt : 0;
  if (!force && suspendedMs < DRIVER_RESUME_THRESHOLD_MS) return;

  const lastReload = Number(sessionStorage.getItem(DRIVER_RESUME_RELOAD_KEY) || '0');
  if (Date.now() - lastReload < DRIVER_RELOAD_GUARD_MS) return;

  // Android puede congelar Supabase Realtime/WebSocket con la pantalla apagada.
  // Las carreras están persistidas en Supabase; una recarga al desbloquear no
  // cancela el viaje: vuelve a hidratar conductor, carrera y notificaciones.
  sessionStorage.setItem(DRIVER_RESUME_RELOAD_KEY, String(Date.now()));
  window.setTimeout(() => window.location.reload(), 100);
}

function registerDriverAndroidReliability() {
  if (typeof window === 'undefined' || driverReliabilityRegistered) return;
  if (!location.pathname.startsWith('/driver') || !/Android/i.test(navigator.userAgent || '')) return;
  driverReliabilityRegistered = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      driverHiddenAt = Date.now();
      void releaseDriverWakeLock();
      return;
    }
    recoverDriverAfterAndroidSuspend();
  });

  window.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) recoverDriverAfterAndroidSuspend(true);
    else void requestDriverWakeLock();
  });

  window.addEventListener('online', () => recoverDriverAfterAndroidSuspend(true));
  window.addEventListener('focus', () => {
    if (driverHiddenAt) recoverDriverAfterAndroidSuspend();
    else void requestDriverWakeLock();
  });

  void requestDriverWakeLock();
}

async function doRegisterServiceWorker() {
  if (serviceWorkerRegistrationStarted || !('serviceWorker' in navigator)) return;
  serviceWorkerRegistrationStarted = true;

  try {
    await purgeLegacyFrontendCaches();

    // No llamamos registration.update() al iniciar ni al volver desde background.
    // Chrome ya revisa el worker según su ciclo normal. Forzar update +
    // skipWaiting/claim podía provocar un controllerchange durante una sesión viva
    // en ciertos Android y dar la sensación de que toda la PWA se recargaba.
    const registration = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none',
    });
    console.log('CentralGo ServiceWorker registered:', registration.scope);
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

  if (document.readyState === 'complete') {
    void doRegisterServiceWorker();
  } else {
    window.addEventListener('load', () => void doRegisterServiceWorker(), { once: true });
  }
}

export async function promptPWAInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const promptEvent = deferredPrompt;
  await promptEvent.prompt();
  const choiceResult = await promptEvent.userChoice;
  deferredPrompt = null;
  return choiceResult.outcome === 'accepted';
}

export function isPWAInstallPromptAvailable(): boolean {
  return Boolean(deferredPrompt);
}

export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}
