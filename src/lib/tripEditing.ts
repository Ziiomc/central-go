import type { Trip } from '../types';
import { requireSupabase } from './supabase';
import { mapTripRow } from './commercialRepository';

export type EditableTripDetails = Pick<
  Trip,
  'clientName' | 'clientPhone' | 'origin' | 'destination' | 'scheduledFor' | 'notes' | 'estimatedFare' | 'paymentMethod'
>;

export async function updateTripDetails(tripId: string, changes: Partial<EditableTripDetails>): Promise<Trip> {
  const payload: Record<string, unknown> = {};

  if (changes.clientName !== undefined) payload.client_name = changes.clientName.trim();
  if (changes.clientPhone !== undefined) payload.client_phone = changes.clientPhone.trim();
  if (changes.origin !== undefined) {
    payload.origin_address = changes.origin.address.trim();
    payload.origin_lat = changes.origin.lat;
    payload.origin_lng = changes.origin.lng;
    payload.origin_notes = changes.origin.notes ?? null;
  }
  if (changes.destination !== undefined) {
    payload.destination_address = changes.destination.address.trim();
    payload.destination_lat = changes.destination.lat;
    payload.destination_lng = changes.destination.lng;
    payload.destination_notes = changes.destination.notes ?? null;
  }
  if ('scheduledFor' in changes) payload.scheduled_for = changes.scheduledFor ?? null;
  if ('notes' in changes) payload.notes = changes.notes?.trim() || null;
  if (changes.estimatedFare !== undefined) payload.estimated_fare = Math.max(0, Number(changes.estimatedFare) || 0);
  if (changes.paymentMethod !== undefined) payload.payment_method = changes.paymentMethod;

  const { data, error } = await requireSupabase()
    .from('trips')
    .update(payload)
    .eq('id', tripId)
    .select('*')
    .single();

  if (error) throw error;
  return mapTripRow(data);
}
