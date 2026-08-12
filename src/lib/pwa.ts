// PWA Registration & Install helper

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenersRegistered = false;
let serviceWorkerRegistrationStarted = false;
let controllerListenerRegistered = false;
const FRESHNESS_KEY = 'centralgo-fresh-bundle-v6';

async function purgeLegacyFrontendCaches() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(FRESHNESS_KEY) === '1') return;
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
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

  // Nunca recargar automáticamente una consola o PWA operativa. En versiones
  // anteriores controllerchange hacía window.location.reload(), lo que podía
  // desmontar la carrera activa al volver desde otra app o cuando el navegador
  // activaba una nueva versión del service worker. La versión nueva se aplica
  // de forma silenciosa y el estado vivo permanece en Supabase/React.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.dispatchEvent(new CustomEvent('centralgo-sw-updated'));
  });
}

async function doRegisterServiceWorker() {
  if (serviceWorkerRegistrationStarted || !('serviceWorker' in navigator)) return;
  serviceWorkerRegistrationStarted = true;

  try {
    await purgeLegacyFrontendCaches();
    const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    console.log('CentralGo ServiceWorker registered:', registration.scope);
    try {
      await registration.update();
    } catch (error) {
      console.warn('CentralGo ServiceWorker update check failed:', error);
    }
  } catch (error) {
    serviceWorkerRegistrationStarted = false;
    console.warn('CentralGo ServiceWorker registration failed:', error);
  }
}

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;

  registerInstallListeners();
  registerControllerListener();

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
