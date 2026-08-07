import { DriverStatus, PaymentMethod, TripStatus } from '../types';

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  en_route: 'Móvil en camino',
  arrived: 'Móvil llegó',
  in_progress: 'Pasajero a bordo',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
};

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  available: 'Libre',
  en_route: 'En camino',
  in_trip: 'En carrera',
  paused: 'Pausa',
  offline: 'Desconectado',
  sos: 'SOS',
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  posnet_tarjeta: 'Tarjeta',
  cuenta_corriente: 'Cuenta corriente',
};
