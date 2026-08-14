import { requireSupabase } from './supabase';

export type DispatchQueueDirection = 'up' | 'down';

export interface DispatchQueueItem {
  driverId: string;
  companyId: string;
  userId: string;
  unitNumber: string;
  name: string;
  status: 'available' | 'en_route' | 'in_trip' | 'paused' | 'offline' | 'sos';
  queueOrder: number;
  queueUpdatedAt: string;
  lat: number | null;
  lng: number | null;
  locationUpdatedAt: string | null;
  locationAddress: string;
  routeDistanceKm: number | null;
  routeDurationSeconds: number | null;
  routeProvider: string | null;
  routeComputedAt: string | null;
}

export const isQueueConnected = (item: DispatchQueueItem) => {
  if (['offline', 'paused', 'sos'].includes(item.status)) return false;
  if (!item.locationUpdatedAt) return true;
  return Date.now() - new Date(item.locationUpdatedAt).getTime() <= 5 * 60 * 1000;
};

export async function loadDispatchQueue(companyId: string, tripId?: string): Promise<DispatchQueueItem[]> {
  const db = requireSupabase();
  const [driversResult, locationsResult, routeResult] = await Promise.all([
    db
      .from('drivers')
      .select('id,company_id,user_id,unit_number,display_name,status,dispatch_queue_order,dispatch_queue_updated_at')
      .eq('company_id', companyId)
      .order('dispatch_queue_order', { ascending: true }),
    db
      .from('driver_locations')
      .select('driver_id,lat,lng,address,recorded_at')
      .eq('company_id', companyId),
    tripId
      ? db.rpc('centralgo_operator_route_metrics', { p_trip_id: tripId })
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (driversResult.error) throw driversResult.error;
  if (locationsResult.error) throw locationsResult.error;
  if (routeResult.error) throw routeResult.error;

  const locations = new Map((locationsResult.data ?? []).map((row: any) => [row.driver_id, row]));
  const routes = new Map((routeResult.data ?? []).map((row: any) => [row.driver_id, row]));
  return (driversResult.data ?? []).map((row: any) => {
    const location = locations.get(row.id) as any;
    const route = routes.get(row.id) as any;
    return {
      driverId: row.id,
      companyId: row.company_id,
      userId: row.user_id ?? '',
      unitNumber: row.unit_number,
      name: row.display_name,
      status: row.status,
      queueOrder: Number(row.dispatch_queue_order ?? 0),
      queueUpdatedAt: row.dispatch_queue_updated_at ?? new Date().toISOString(),
      lat: location?.lat == null ? null : Number(location.lat),
      lng: location?.lng == null ? null : Number(location.lng),
      locationUpdatedAt: location?.recorded_at ?? null,
      locationAddress: location?.address ?? 'Sin ubicación GPS reportada',
      routeDistanceKm: route?.distance_km == null ? null : Number(route.distance_km),
      routeDurationSeconds: route?.duration_seconds == null ? null : Number(route.duration_seconds),
      routeProvider: route?.provider ?? null,
      routeComputedAt: route?.computed_at ?? null,
    } satisfies DispatchQueueItem;
  });
}

export async function refreshDispatchRouteMatrix(tripId: string) {
  const { error } = await requireSupabase().rpc('centralgo_operator_refresh_route_matrix', { p_trip_id: tripId });
  if (error) throw error;
}

export async function moveDispatchPriority(driverId: string, direction: DispatchQueueDirection) {
  const { error } = await requireSupabase().rpc('centralgo_operator_move_driver_priority', {
    p_driver_id: driverId,
    p_direction: direction,
  });
  if (error) throw error;
}

export function subscribeDispatchQueue(companyId: string, onChange: () => void) {
  const db = requireSupabase();
  let timer: number | null = null;
  const schedule = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 120);
  };
  const channel = db
    .channel(`centralgo-dispatch-priority:${companyId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: `company_id=eq.${companyId}` }, schedule)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: `company_id=eq.${companyId}` }, schedule)
    .subscribe();

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    void db.removeChannel(channel);
  };
}
