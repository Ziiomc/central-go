import { requireSupabase } from './supabase';

export async function cancelOwnDriverTrip(tripId: string, reason: string): Promise<void> {
  const cleanReason = reason.trim();
  if (!tripId) throw new Error('No hay una carrera activa para cancelar.');
  if (!cleanReason) throw new Error('Selecciona un motivo de cancelación.');

  const { error } = await requireSupabase().rpc('centralgo_driver_cancel_trip', {
    p_trip_id: tripId,
    p_reason: cleanReason,
  });

  if (error) throw error;
}
