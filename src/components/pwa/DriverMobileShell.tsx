import React, { useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { DriverMobileView } from './DriverMobileView';

const ACTIVE_TRIP_STATUSES = new Set(['assigned', 'en_route', 'arrived', 'in_progress']);

/**
 * Keeps the driver's operational view aligned with the authoritative trip state.
 *
 * DriverMobileView intentionally owns short-lived UI state such as the incoming
 * trip offer. When an operator cancels or unassigns a trip, Supabase realtime
 * removes that trip from the active set. Changing the key below remounts only
 * the driver's operational view, which immediately clears any stale offer/card.
 *
 * We also request a fresh snapshot whenever the PWA returns to the foreground,
 * covering mobile browsers that suspended the realtime socket while locked or
 * backgrounded.
 */
export const DriverMobileShell: React.FC = () => {
  const { currentUser, drivers, trips } = useApp();

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
    const requestResync = () => window.dispatchEvent(new Event('centralgo:driver-resync'));
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

  return <DriverMobileView key={activeTripId ?? 'driver-idle'} />;
};
