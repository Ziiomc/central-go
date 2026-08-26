import type { Trip } from '../types';
import { mapTripRow } from './commercialRepository';
import { requireSupabase } from './supabase';

export async function reserveScheduledTripAtomic(tripId: string, driverId: string | null): Promise<Trip> {
  const { data, error } = await requireSupabase().rpc('centralgo_operator_reserve_scheduled_trip', {
    p_trip_id: tripId,
    p_driver_id: driverId,
  });
  if (error) throw error;
  return mapTripRow(data);
}
