import { requireSupabase } from './supabase';
import { mapTripRow } from './commercialRepository';
import type { Trip } from '../types';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function autoDispatchTripAtomic(tripId: string): Promise<Trip> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_operator_auto_dispatch_trip', { p_trip_id: tripId });

  // El RPC ahora encola primero la matriz vial real. Si ya hubo un fallback o
  // una asignación inmediata, devolvemos el estado final sin esperar.
  if (!error && data && data.status !== 'pending') return mapTripRow(data);
  if (error) {
    const { data: recovered, error: readError } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!readError && recovered) {
      console.warn('[Central GO] Auto-dispatch recovered current trip state after RPC failure.', error);
      return mapTripRow(recovered);
    }
    throw error ?? readError ?? new Error('No fue posible recuperar la carrera después del despacho automático.');
  }

  // La Edge Function normalmente resuelve la matriz y asigna en menos de este
  // margen. No bloqueamos indefinidamente la UI: el cron de 5 s conserva el
  // fallback GPS si el router externo no responde.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(250);
    const { data: current, error: readError } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (readError) continue;
    if (!current) break;
    if (current.status !== 'pending' || current.driver_id || current.reserved_driver_id) return mapTripRow(current);
  }

  const { data: current, error: readError } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (!readError && current) return mapTripRow(current);
  throw readError ?? new Error('No fue posible recuperar la carrera después del despacho automático.');
}
