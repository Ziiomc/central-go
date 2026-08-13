import { requireSupabase } from './supabase';
import { mapTripRow } from './commercialRepository';
import type { Trip } from '../types';

export async function autoDispatchTripAtomic(tripId: string): Promise<Trip> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_operator_auto_dispatch_trip', { p_trip_id: tripId });
  if (!error && data) return mapTripRow(data);

  // Preserve the trip if the dispatch RPC races with the cron or the network
  // briefly fails. The current database row remains authoritative and the
  // automatic dispatcher can safely retry it.
  const { data: current, error: readError } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (!readError && current) {
    console.warn('[Central GO] Auto-dispatch recovered current trip state after RPC failure.', error);
    return mapTripRow(current);
  }

  throw error ?? readError ?? new Error('No fue posible recuperar la carrera después del despacho automático.');
}
