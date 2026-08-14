type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type?: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

let sentinel: WakeLockSentinelLike | null = null;
let registered = false;
let retryTimer: number | null = null;

const isDriverRoute = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/driver');
const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

/* Android already has a specialized wake-lock + suspend/resync manager in pwa.ts.
   This helper covers Safari/iOS and other compatible browsers so we do not run
   two independent WakeLockSentinels on the same Android driver session. */
const shouldManageWakeLockHere = () => isDriverRoute() && !isAndroid();

const clearRetry = () => {
  if (retryTimer !== null) window.clearTimeout(retryTimer);
  retryTimer = null;
};

const scheduleRetry = () => {
  clearRetry();
  if (!shouldManageWakeLockHere() || document.visibilityState !== 'visible') return;
  retryTimer = window.setTimeout(() => void acquireDriverWakeLock(), 15000);
};

export const acquireDriverWakeLock = async () => {
  if (!shouldManageWakeLockHere() || document.visibilityState !== 'visible') return false;
  const nav = navigator as NavigatorWithWakeLock;
  if (!nav.wakeLock?.request) return false;
  if (sentinel && sentinel.released !== true) return true;

  try {
    sentinel = await nav.wakeLock.request('screen');
    clearRetry();
    sentinel.addEventListener?.('release', () => {
      sentinel = null;
      scheduleRetry();
    });
    window.dispatchEvent(new CustomEvent('centralgo:driver-wake-lock', { detail: { active: true } }));
    return true;
  } catch (error) {
    sentinel = null;
    window.dispatchEvent(new CustomEvent('centralgo:driver-wake-lock', { detail: { active: false } }));
    console.info('[Central GO] Screen Wake Lock no disponible temporalmente.', error);
    scheduleRetry();
    return false;
  }
};

export const releaseDriverWakeLock = async () => {
  clearRetry();
  const current = sentinel;
  sentinel = null;
  if (!current || current.released === true) return;
  try { await current.release(); } catch { }
};

export const registerDriverWakeLock = () => {
  if (registered || typeof window === 'undefined' || typeof document === 'undefined' || isAndroid()) return;
  registered = true;

  const resume = () => {
    if (shouldManageWakeLockHere() && document.visibilityState === 'visible') void acquireDriverWakeLock();
  };
  const gestureResume = () => {
    if (shouldManageWakeLockHere()) void acquireDriverWakeLock();
  };
  const pageHide = () => void releaseDriverWakeLock();

  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  window.addEventListener('pageshow', resume);
  window.addEventListener('pointerdown', gestureResume, { passive: true });
  window.addEventListener('touchstart', gestureResume, { passive: true });
  window.addEventListener('keydown', gestureResume);
  window.addEventListener('pagehide', pageHide);

  if (shouldManageWakeLockHere()) void acquireDriverWakeLock();
};
