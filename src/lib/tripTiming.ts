import type { Trip } from '../types';
import { requireSupabase } from './supabase';

export const RESERVATION_DISPATCH_WINDOW_MS = 20 * 60 * 1000;
export const RESERVATION_ALARM_WINDOW_MS = 10 * 60 * 1000;
export const WARNING_DELAY_MS = 3 * 60 * 1000;
export const CRITICAL_DELAY_MS = 5 * 60 * 1000;

let serverOffsetMs = 0;
let lastClockSyncAt = 0;
let clockSyncPromise: Promise<number> | null = null;

const parseTimestamp = (value?: string) => {
  if (!value) return Number.NaN;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
};

export const synchronizedNow = () => Date.now() + serverOffsetMs;

export async function synchronizeServerClock(force = false): Promise<number> {
  if (!force && lastClockSyncAt && Date.now() - lastClockSyncAt < 4 * 60 * 1000) return serverOffsetMs;
  if (clockSyncPromise) return clockSyncPromise;

  clockSyncPromise = (async () => {
    const requestStartedAt = Date.now();
    const { data, error } = await requireSupabase().rpc('centralgo_server_time');
    const requestFinishedAt = Date.now();
    if (error) throw error;

    const serverTime = parseTimestamp(typeof data === 'string' ? data : String(data ?? ''));
    if (!Number.isFinite(serverTime)) throw new Error('El servidor devolvió una hora inválida.');

    serverOffsetMs = serverTime - (requestStartedAt + requestFinishedAt) / 2;
    lastClockSyncAt = requestFinishedAt;
    return serverOffsetMs;
  })().finally(() => { clockSyncPromise = null; });

  return clockSyncPromise;
}

export const tripReferenceTimeMs = (trip: Pick<Trip, 'createdAt' | 'scheduledFor'>) => {
  const scheduledTime = parseTimestamp(trip.scheduledFor);
  if (Number.isFinite(scheduledTime)) return scheduledTime;
  const createdTime = parseTimestamp(trip.createdAt);
  return Number.isFinite(createdTime) ? createdTime : synchronizedNow();
};

export const tripDelayMs = (trip: Pick<Trip, 'createdAt' | 'scheduledFor'>, now = synchronizedNow()) =>
  now - tripReferenceTimeMs(trip);

export const tripDelayMinutes = (trip: Pick<Trip, 'createdAt' | 'scheduledFor'>, now = synchronizedNow()) =>
  Math.max(0, Math.floor(tripDelayMs(trip, now) / 60000));

export const tripMinutesUntil = (trip: Pick<Trip, 'createdAt' | 'scheduledFor'>, now = synchronizedNow()) =>
  Math.max(0, Math.ceil(-tripDelayMs(trip, now) / 60000));

export const tripUrgency = (trip: Pick<Trip, 'createdAt' | 'scheduledFor'>, now = synchronizedNow()) => {
  const delay = tripDelayMs(trip, now);
  if (delay >= CRITICAL_DELAY_MS) return 'critical' as const;
  if (delay >= WARNING_DELAY_MS) return 'warning' as const;
  if (trip.scheduledFor && delay < 0) return 'scheduled' as const;
  return 'normal' as const;
};
