// PWA Registration & Install helper

let deferredPrompt: any = null;
let controllerReloaded = false;

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then(async (reg) => {
          console.log('CentralGo ServiceWorker registered:', reg.scope);

          // Buscar una versión nueva inmediatamente en vez de esperar al ciclo
          // normal del navegador. Esto es especialmente importante para una PWA
          // comercial que cambia con frecuencia durante pilotos y demostraciones.
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
      // Una sola recarga controlada garantiza que, cuando el nuevo worker toma
      // el control, la interfaz visible corresponda al bundle recién desplegado.
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
      if (choiceResult.outcome === 'accepted') {
        resolve(true);
      } else {
        resolve(false);
      }
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
