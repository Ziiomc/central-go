export interface RoadPoint {
  lat: number;
  lng: number;
}

export interface RouteAdvanceResult {
  point: RoadPoint;
  index: number;
  remainingOnSegmentMeters: number;
  heading: number;
  finished: boolean;
}

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';
const routeCache = new Map<string, RoadPoint[]>();

// Puntos conocidos de Linares usados como respaldo cuando el servicio de rutas
// no está disponible. Todos corresponden a sectores visibles en la demo.
const LINARES_ROAD_LATITUDES = [-35.852, -35.849, -35.848, -35.8454, -35.843, -35.8412];
const LINARES_ROAD_LONGITUDES = [-71.603, -71.5979, -71.595, -71.5921, -71.588];

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export const distanceMeters = (from: RoadPoint, to: RoadPoint) => {
  const earthRadius = 6_371_000;
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const bearingDegrees = (from: RoadPoint, to: RoadPoint) => {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

const interpolatePoint = (from: RoadPoint, to: RoadPoint, ratio: number): RoadPoint => ({
  lat: from.lat + (to.lat - from.lat) * ratio,
  lng: from.lng + (to.lng - from.lng) * ratio,
});

const roundCoordinate = (value: number) => value.toFixed(5);

const routeKey = (start: RoadPoint, end: RoadPoint) =>
  `${roundCoordinate(start.lat)},${roundCoordinate(start.lng)}:${roundCoordinate(end.lat)},${roundCoordinate(end.lng)}`;

const closestValue = (value: number, candidates: number[]) =>
  candidates.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
  );

const deduplicatePoints = (points: RoadPoint[]) =>
  points.filter((point, index) => {
    if (index === 0) return true;
    return distanceMeters(points[index - 1], point) > 1;
  });

const densifyRoute = (points: RoadPoint[], maxSegmentMeters = 18) => {
  if (points.length < 2) return points;

  const dense: RoadPoint[] = [points[0]];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const segmentDistance = distanceMeters(start, end);
    const pieces = Math.max(1, Math.ceil(segmentDistance / maxSegmentMeters));

    for (let piece = 1; piece <= pieces; piece += 1) {
      dense.push(interpolatePoint(start, end, piece / pieces));
    }
  }

  return deduplicatePoints(dense);
};

/**
 * Respaldo sin internet: crea un trayecto ortogonal por corredores de la
 * cuadrícula céntrica de Linares, evitando la línea diagonal directa.
 */
export const buildFallbackRoadRoute = (start: RoadPoint, end: RoadPoint): RoadPoint[] => {
  const startStreetLat = closestValue(start.lat, LINARES_ROAD_LATITUDES);
  const startStreetLng = closestValue(start.lng, LINARES_ROAD_LONGITUDES);
  const endStreetLat = closestValue(end.lat, LINARES_ROAD_LATITUDES);
  const endStreetLng = closestValue(end.lng, LINARES_ROAD_LONGITUDES);

  const horizontalFirst = Math.abs(start.lng - end.lng) >= Math.abs(start.lat - end.lat);
  const points: RoadPoint[] = [start, { lat: startStreetLat, lng: startStreetLng }];

  if (horizontalFirst) {
    points.push({ lat: startStreetLat, lng: endStreetLng });
    points.push({ lat: endStreetLat, lng: endStreetLng });
  } else {
    points.push({ lat: endStreetLat, lng: startStreetLng });
    points.push({ lat: endStreetLat, lng: endStreetLng });
  }

  points.push(end);
  return densifyRoute(deduplicatePoints(points));
};

export async function requestDrivingRoute(
  start: RoadPoint,
  end: RoadPoint,
  signal?: AbortSignal
): Promise<RoadPoint[]> {
  const key = routeKey(start, end);
  const cached = routeCache.get(key);
  if (cached) return cached;

  const url = `${OSRM_BASE_URL}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=false`;

  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) throw new Error(`OSRM respondió ${response.status}`);

    const payload = (await response.json()) as {
      code?: string;
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };

    const coordinates = payload.routes?.[0]?.geometry?.coordinates;
    if (payload.code !== 'Ok' || !coordinates || coordinates.length < 2) {
      throw new Error('El servicio no devolvió una ruta utilizable');
    }

    const route = densifyRoute(
      coordinates.map(([lng, lat]) => ({ lat, lng }))
    );

    // Evita crecimiento indefinido durante demos largas.
    if (routeCache.size > 80) {
      const firstKey = routeCache.keys().next().value as string | undefined;
      if (firstKey) routeCache.delete(firstKey);
    }
    routeCache.set(key, route);
    return route;
  } catch (error) {
    if (signal?.aborted) throw error;
    const fallback = buildFallbackRoadRoute(start, end);
    routeCache.set(key, fallback);
    return fallback;
  }
}

export function advanceAlongRoute(
  route: RoadPoint[],
  currentIndex: number,
  remainingOnSegmentMeters: number,
  travelMeters: number
): RouteAdvanceResult {
  if (route.length < 2 || currentIndex >= route.length - 1) {
    const point = route[route.length - 1] ?? { lat: 0, lng: 0 };
    return {
      point,
      index: Math.max(0, route.length - 1),
      remainingOnSegmentMeters: 0,
      heading: 0,
      finished: true,
    };
  }

  let index = currentIndex;
  let remainingTravel = Math.max(0, travelMeters);
  let offset = Math.max(0, remainingOnSegmentMeters);
  let point = route[index];

  while (index < route.length - 1) {
    const segmentStart = route[index];
    const segmentEnd = route[index + 1];
    const segmentDistance = Math.max(0.01, distanceMeters(segmentStart, segmentEnd));
    const availableDistance = Math.max(0, segmentDistance - offset);

    if (remainingTravel < availableDistance) {
      offset += remainingTravel;
      point = interpolatePoint(segmentStart, segmentEnd, offset / segmentDistance);
      return {
        point,
        index,
        remainingOnSegmentMeters: offset,
        heading: bearingDegrees(segmentStart, segmentEnd),
        finished: false,
      };
    }

    remainingTravel -= availableDistance;
    index += 1;
    offset = 0;
    point = route[index];
  }

  const previousPoint = route[Math.max(0, route.length - 2)];
  return {
    point: route[route.length - 1],
    index: route.length - 1,
    remainingOnSegmentMeters: 0,
    heading: bearingDegrees(previousPoint, route[route.length - 1]),
    finished: true,
  };
}
