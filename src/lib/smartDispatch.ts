import { requireSupabase } from './supabase';
import { mapTripRow } from './commercialRepository';
import type { Trip } from '../types';

export async function autoDispatchTripAtomic(tripId: string): Promise<Trip> {
  const { data, error } = await requireSupabase().rpc('centralgo_operator_auto_dispatch_trip', { p_trip_id: tripId });
  if (error) throw error;
  return mapTripRow(data);
}
