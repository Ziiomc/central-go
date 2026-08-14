import { requireSupabase } from './supabase';
import { distanceMeters, type RoadPoint } from './roadRouting';

export interface DrivingRouteMetrics {
  distanceKm: number;
  durationSeconds: number | null;
  provider: string;
  exactRoadRoute: boolean;
}

/**
 * Estimación local de respaldo. Nunca debe bloquear un despacho si el router
 * vial no está disponible.
 */
export const estimateDrivingDistanceKm = (start: RoadPoint, end: RoadPoint) => {
  const directKm = distanceMeters(start, end) / 1000;
  if (!Number.isFinite(directKm) || directKm <= 0) return 0;
  const roadFactor = directKm < 3 ? 1.32 : directKm < 15 ? 1.24 : 1.18;
  return Math.round(Math.max(0.1, directKm * roadFactor) * 10) / 10;
};

/**
 * Distancia vial real calculada en Supabase Edge, no en el navegador.
 */
export async function requestDrivingRouteMetrics(
  companyId: string,
  start: RoadPoint,
  end: RoadPoint,
): Promise<DrivingRouteMetrics> {
  const { data, error } = await requireSupabase().functions.invoke('route-distance', {
    body: { companyId, start, end },
  });
  if (error) throw new Error(error.message || 'No fue posible calcular la ruta vial.');
  if (data?.error) throw new Error(String(data.error));
  const distanceKm = Number(data?.distanceKm);
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error('El router devolvió una distancia inválida.');
  return {
    distanceKm,
    durationSeconds: Number.isFinite(Number(data?.durationSeconds)) ? Number(data.durationSeconds) : null,
    provider: String(data?.provider || 'road-router'),
    exactRoadRoute: Boolean(data?.exactRoadRoute),
  };
}

export async function resolveDrivingRouteMetrics(
  companyId: string,
  start: RoadPoint,
  end: RoadPoint,
): Promise<DrivingRouteMetrics> {
  try {
    return await requestDrivingRouteMetrics(companyId, start, end);
  } catch {
    return {
      distanceKm: estimateDrivingDistanceKm(start, end),
      durationSeconds: null,
      provider: 'gps-fallback',
      exactRoadRoute: false,
    };
  }
}
