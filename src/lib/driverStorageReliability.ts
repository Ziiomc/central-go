type NavigatorWithStoragePersistence = Navigator & {
  storage?: StorageManager & {
    persist?: () => Promise<boolean>;
    persisted?: () => Promise<boolean>;
  };
};

const STORAGE_KEY = 'centralgo:driver-storage-persistence-v1';
let registered = false;
let busy = false;

const isDriverRoute = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/driver');

const requestPersistence = async () => {
  if (!isDriverRoute() || busy) return;
  const nav = navigator as NavigatorWithStoragePersistence;
  if (!nav.storage?.persist || !nav.storage?.persisted) return;
  if (localStorage.getItem(STORAGE_KEY) === 'granted') return;

  busy = true;
  try {
    const alreadyPersistent = await nav.storage.persisted();
    if (alreadyPersistent) {
      localStorage.setItem(STORAGE_KEY, 'granted');
      return;
    }
    const granted = await nav.storage.persist();
    localStorage.setItem(STORAGE_KEY, granted ? 'granted' : 'denied');
    window.dispatchEvent(new CustomEvent('centralgo:driver-storage-persistence', { detail: { granted } }));
  } catch {
    // Persistence is an optional reliability enhancement. A browser that does
    // not grant it must never prevent the driver from working.
  } finally {
    busy = false;
  }
};

export const registerDriverStorageReliability = () => {
  if (registered || typeof window === 'undefined' || typeof document === 'undefined') return;
  registered = true;

  const activate = () => {
    if (!isDriverRoute()) return;
    void requestPersistence();
    window.removeEventListener('pointerdown', activate, true);
    window.removeEventListener('touchstart', activate, true);
    window.removeEventListener('keydown', activate, true);
  };

  // Browsers are more likely to grant persistent storage after a meaningful
  // user interaction, so we request it on the first driver action.
  window.addEventListener('pointerdown', activate, { capture: true, passive: true });
  window.addEventListener('touchstart', activate, { capture: true, passive: true });
  window.addEventListener('keydown', activate, true);
};
