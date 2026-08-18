import React, { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DriverMobileView } from './DriverMobileView';
import { DriverThemeCycleButton } from './DriverThemeCycleButton';
import { DriverPushRegistration } from './DriverPushRegistration';

const ACTIVE_TRIP_STATUSES = new Set(['assigned', 'en_route', 'arrived', 'in_progress']);
const FOREGROUND_RESYNC_COOLDOWN_MS = 10000;

/**
 * Keeps the driver's operational view aligned with the authoritative trip state.
 *
 * DriverMobileView intentionally owns short-lived UI state such as the incoming
 * trip offer. When an operator cancels or unassigns a trip, Supabase realtime
 * removes that trip from the active set. Changing the key below remounts only
 * the driver's operational view, which immediately clears any stale offer/card.
 *
 * Mobile browsers commonly emit visibilitychange + focus + pageshow together
 * when the phone unlocks. Those events are collapsed into one reconciliation,
 * and short app-switch bursts reuse realtime instead of reloading a full
 * operational snapshot repeatedly.
 *
 * DriverPushRegistration is mounted at this shell level so every authenticated
 * driver gets the one-time Web Push activation flow required for reliable
 * locked-screen trip alerts.
 */
export const DriverMobileShell: React.FC = () => {
  const { currentUser, drivers, trips } = useApp();
  const lastForegroundResyncAt = useRef(0);

  const driverId = useMemo(
    () => drivers.find((driver) => driver.userId === currentUser.id)?.id,
    [currentUser.id, drivers],
  );

  const activeTripId = useMemo(
    () => trips.find(
      (trip) => trip.driverId === driverId && ACTIVE_TRIP_STATUSES.has(trip.status),
    )?.id,
    [driverId, trips],
  );

  useEffect(() => {
    const requestResync = () => {
      if (!navigator.onLine || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastForegroundResyncAt.current < FOREGROUND_RESYNC_COOLDOWN_MS) return;
      lastForegroundResyncAt.current = now;
      window.dispatchEvent(new CustomEvent('centralgo:driver-resync', {
        detail: { reason: 'driver-foreground' },
      }));
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestResync();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', requestResync);
    window.addEventListener('pageshow', requestResync);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', requestResync);
      window.removeEventListener('pageshow', requestResync);
    };
  }, []);

  return <>
    <DriverMobileView key={activeTripId ?? 'driver-idle'} />
    <DriverPushRegistration />
    <DriverThemeCycleButton />
  </>;
};
