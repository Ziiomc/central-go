// PWA Registration & Install helper

let deferredPrompt: any = null;
let controllerReloaded = false;
const FRESHNESS_KEY = 'centralgo-fresh-bundle-v4';

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

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    void purgeLegacyFrontendCaches();

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then(async (reg) => {
          console.log('CentralGo ServiceWorker registered:', reg.scope);
          try {
            await reg.update();
          } catch (error) {
            console.warn('CentralGo ServiceWorker update check failed:', error);
          }
        })
        .catch((err) => {
          console.log('CentralGo ServiceWorker registration failed:', err);
        });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (controllerReloaded) return;
      if (sessionStorage.getItem('centralgo-sw-refresh') === '1') {
        sessionStorage.removeItem('centralgo-sw-refresh');
        return;
      }
      controllerReloaded = true;
      sessionStorage.setItem('centralgo-sw-refresh', '1');
      window.location.reload();
    });

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      window.dispatchEvent(new CustomEvent('pwa-installable'));
    });
  }
}

export function promptPWAInstall(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!deferredPrompt) {
      resolve(false);
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
      deferredPrompt = null;
      resolve(choiceResult.outcome === 'accepted');
    });
  });
}

export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}
