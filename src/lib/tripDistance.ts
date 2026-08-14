import { distanceMeters, type RoadPoint } from './roadRouting';

/**
 * Estimación rápida y resistente para despacho.
 *
 * La distancia geodésica entre retiro y destino se corrige con un factor de
 * recorrido vial. Así el despacho no depende de un router externo para poder
 * informar kilómetros aproximados al conductor. El resultado es deliberadamente
 * aproximado y se redondea a una décima de kilómetro.
 */
export const estimateDrivingDistanceKm = (start: RoadPoint, end: RoadPoint) => {
  const directKm = distanceMeters(start, end) / 1000;
  if (!Number.isFinite(directKm) || directKm <= 0) return 0;

  // En trayectos urbanos cortos calles, esquinas y sentidos únicos suelen
  // separar más la distancia vial de la línea recta. En trayectos largos la
  // diferencia relativa normalmente baja.
  const roadFactor = directKm < 3 ? 1.32 : directKm < 15 ? 1.24 : 1.18;
  return Math.round(Math.max(0.1, directKm * roadFactor) * 10) / 10;
};
