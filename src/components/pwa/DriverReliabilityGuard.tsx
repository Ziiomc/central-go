import React, { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';

const ANDROID_RE = /Android/i;
const RESUME_RELOAD_AFTER_MS = 8000;
const RELOAD_GUARD_MS = 12000;
const LAST_RELOAD_KEY = 'centralgo-driver-last-auto-resume-reload';

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

/**
 * Android puede congelar timers, WebSocket/Realtime y geolocalización cuando
 * la pantalla se apaga. Este guard evita el auto-bloqueo mientras el conductor
 * está operativo y, si Android igualmente suspendió la PWA, fuerza una
 * resincronización completa al volver después de una suspensión real.
 */
export const DriverReliabilityGuard: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { currentRole, drivers, currentUser, trips } = useApp();
  const hiddenAtRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const acquiringWakeLockRef = useRef(false);

  const driver = drivers.find((item) => item.userId === currentUser.id);
  const hasLiveTrip = Boolean(driver && trips.some((trip) => trip.driverId === driver.id && ['assigned', 'en_route', 'arrived', 'in_progress'].includes(trip.status)));
  const shouldKeepAwake = currentRole === 'driver' && Boolean(driver) && !['paused', 'offline'].includes(driver?.status ?? 'offline');

  const releaseWakeLock = async () => {
    const current = wakeLockRef.current;
    wakeLockRef.current = null;
    if (!current || current.released) return;
    try { await current.release(); } catch {}
  };

  const requestWakeLock = async () => {
    if (!ANDROID_RE.test(navigator.userAgent || '') || !shouldKeepAwake || document.visibilityState !== 'visible') return;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock?.request || wakeLockRef.current || acquiringWakeLockRef.current) return;
    acquiringWakeLockRef.current = true;
    try {
      const sentinel = await nav.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      sentinel.addEventListener?.('release', () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
      });
    } catch {
      // Algunos fabricantes bloquean Wake Lock por ahorro de batería.
    } finally {
      acquiringWakeLockRef.current = false;
    }
  };

  useEffect(() => {
    if (currentRole !== 'driver' || !ANDROID_RE.test(navigator.userAgent || '')) return;

    const recoverAfterSuspend = () => {
      if (document.visibilityState !== 'visible') return;
      void requestWakeLock();

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (!hiddenAt) return;

      const suspendedMs = Date.now() - hiddenAt;
      if (suspendedMs < RESUME_RELOAD_AFTER_MS) return;

      const lastReload = Number(sessionStorage.getItem(LAST_RELOAD_KEY) || '0');
      if (Date.now() - lastReload < RELOAD_GUARD_MS) return;

      // Realtime puede haberse desconectado durante el bloqueo. La carrera vive
      // en Supabase, por lo que recargar aquí no la cancela: simplemente vuelve
      // a hidratar conductor + carrera + notificaciones desde producción.
      sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
      window.setTimeout(() => window.location.reload(), hasLiveTrip ? 250 : 80);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        void releaseWakeLock();
        return;
      }
      recoverAfterSuspend();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !hiddenAtRef.current) hiddenAtRef.current = Date.now() - RESUME_RELOAD_AFTER_MS - 1;
      recoverAfterSuspend();
    };

    const onOnline = () => {
      if (!hiddenAtRef.current) hiddenAtRef.current = Date.now() - RESUME_RELOAD_AFTER_MS - 1;
      recoverAfterSuspend();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);
    void requestWakeLock();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      void releaseWakeLock();
    };
  }, [currentRole, driver?.id, driver?.status, hasLiveTrip]);

  return <>{children}</>;
};
