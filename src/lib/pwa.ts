// PWA Registration & Install helper

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let controllerReloaded = false;
let listenersRegistered = false;
let serviceWorkerRegistrationStarted = false;
const FRESHNESS_KEY = 'centralgo-fresh-bundle-v5';

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

  // El listener de instalación debe existir lo antes posible, incluso antes de que
  // el service worker termine de registrarse.
  registerInstallListeners();

  if (!('serviceWorker' in navigator)) return;

  // Antes se registraba solamente dentro de window.load. Si React llamaba esta
  // función después de que load ya había ocurrido, el SW nunca se registraba y
  // Chromium no consideraba la app instalable. Ahora registramos inmediatamente
  // cuando el documento ya terminó de cargar.
  if (document.readyState === 'complete') {
    void doRegisterServiceWorker();
  } else {
    window.addEventListener('load', () => void doRegisterServiceWorker(), { once: true });
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controllerReloaded) return;
    if (sessionStorage.getItem('centralgo-sw-refresh') === '1') {
      sessionStorage.removeItem('centralgo-sw-refresh');
      return;
    }
    controllerReloaded = true;
    sessionStorage.setItem('centralgo-sw-refresh', '1');
    window.location.reload();
  }, { once: true });
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
