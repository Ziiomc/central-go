import { requireSupabase } from './supabase';
import type {
  AppNotification,
  AuditLog,
  Client,
  Company,
  Driver,
  DriverStatus,
  FareConfig,
  PaymentMethod,
  Trip,
  TripStatus,
  User,
  Vehicle,
} from '../types';

const n = (value: unknown, fallback = 0) => value == null ? fallback : Number(value);

export const mapCompanyRow = (row: any): Company => ({
  id: row.id,
  name: row.name,
  code: row.code,
  phone: row.phone ?? '',
  address: row.address ?? '',
  vhfFrequency: row.vhf_frequency ?? undefined,
  totalVehicles: Number(row.total_vehicles ?? 0),
  totalDrivers: Number(row.total_drivers ?? 0),
  active: row.active ?? true,
  logoUrl: row.logo_url ?? undefined,
});

export const mapVehicleRow = (row: any): Vehicle => ({
  id: row.id,
  companyId: row.company_id,
  unitNumber: row.unit_number,
  licensePlate: row.license_plate,
  brand: row.brand,
  model: row.model,
  year: row.year,
  color: row.color ?? '',
  capacity: row.capacity,
  petFriendly: row.pet_friendly,
  wheelchairAccessible: row.wheelchair_accessible,
  airConditioning: row.air_conditioning,
  technicalInspectionExpiry: row.technical_inspection_expiry ?? '',
  status: row.status,
});

export const mapDriverRow = (row: any, location?: any): Driver => ({
  id: row.id,
  userId: row.user_id ?? '',
  companyId: row.company_id,
  vehicleId: row.vehicle_id ?? undefined,
  unitNumber: row.unit_number,
  name: row.display_name,
  phone: row.phone ?? '',
  licenseNumber: row.license_number,
  licenseExpiry: row.license_expiry ?? '',
  photoUrl: row.photo_url ?? '',
  status: row.status,
  operationMode: row.operation_mode === 'traditional' ? 'traditional' : 'app',
  currentLocation: {
    lat: location?.lat ?? 0,
    lng: location?.lng ?? 0,
    address: location?.address ?? 'Sin ubicación GPS reportada',
    speed: location?.speed_kmh == null ? 0 : Number(location.speed_kmh),
    heading: location?.heading_degrees == null ? 0 : Number(location.heading_degrees),
    lastUpdated: location?.recorded_at ?? row.updated_at,
  },
  rating: n(row.rating, 5),
  totalTripsCompleted: row.total_trips_completed ?? 0,
  todayEarnings: n(row.today_earnings),
  commissionBalance: n(row.commission_balance),
  sosActive: row.sos_active,
  sosTimestamp: row.sos_timestamp ?? undefined,
});

export const mapTripRow = (row: any): Trip => ({
  id: row.id,
  companyId: row.company_id,
  code: row.code,
  operatorRequestId: row.operator_request_id ?? undefined,
  clientId: row.client_id ?? undefined,
  clientName: row.client_name,
  clientPhone: row.client_phone,
  origin: {
    address: row.origin_address,
    lat: row.origin_lat,
    lng: row.origin_lng,
    notes: row.origin_notes ?? undefined,
  },
  destination: {
    address: row.destination_address,
    lat: row.destination_lat,
    lng: row.destination_lng,
    notes: row.destination_notes ?? undefined,
  },
  status: row.status,
  driverId: row.driver_id ?? undefined,
  driverUnitNumber: row.driver_unit_number ?? undefined,
  driverName: row.driver_name ?? undefined,
  reservedDriverId: row.reserved_driver_id ?? undefined,
  reservedDriverUnitNumber: row.reserved_driver_unit_number ?? undefined,
  reservedDriverName: row.reserved_driver_name ?? undefined,
  reservationReason: row.reservation_reason ?? undefined,
  operatorId: row.operator_user_id ?? '',
  operatorName: row.operator_name,
  vehicleTypeRequested: row.vehicle_type_requested ?? undefined,
  estimatedDistanceKm: n(row.estimated_distance_km),
  estimatedDurationMins: row.estimated_duration_mins ?? 0,
  estimatedFare: n(row.estimated_fare),
  finalFare: row.final_fare == null ? undefined : n(row.final_fare),
  isFixedFare: row.is_fixed_fare,
  fixedFareAmount: row.fixed_fare_amount == null ? undefined : n(row.fixed_fare_amount),
  paymentMethod: row.payment_method,
  notes: row.notes ?? undefined,
  dispatchMode: row.dispatch_mode ?? 'automatic',
  scheduledFor: row.scheduled_for ?? undefined,
  offerExpiresAt: row.offer_expires_at ?? undefined,
  offerAttempt: row.offer_attempt ?? 0,
  createdAt: row.created_at,
  assignedAt: row.assigned_at ?? undefined,
  enRouteAt: row.en_route_at ?? undefined,
  arrivedAt: row.arrived_at ?? undefined,
  startedAt: row.started_at ?? undefined,
  completedAt: row.completed_at ?? undefined,
  cancelledAt: row.cancelled_at ?? undefined,
  cancelReason: row.cancel_reason ?? undefined,
  rating: row.rating == null ? undefined : n(row.rating),
  feedback: row.feedback ?? undefined,
});

export const mapClientRow = (row: any, addresses: any[] = []): Client => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  phone: row.phone,
  email: row.email ?? undefined,
  frequentAddresses: addresses.map((address) => ({
    label: address.label,
    address: address.address,
    lat: address.lat,
    lng: address.lng,
  })),
  totalTrips: row.total_trips,
  rating: n(row.rating, 5),
  isVIP: row.is_vip,
  notes: row.notes ?? undefined,
  hasCurrentAccount: row.has_current_account,
});

export const mapNotificationRow = (row: any): AppNotification => ({
  id: row.id,
  companyId: row.company_id,
  recipientUserId: row.recipient_user_id ?? undefined,
  title: row.title,
  message: row.message,
  type: row.type,
  read: row.read,
  timestamp: row.created_at,
  relatedId: row.related_id ?? undefined,
});

export const mapAuditRow = (row: any): AuditLog => ({
  id: String(row.id),
  companyId: row.company_id ?? '',
  userName: row.user_name ?? 'Sistema',
  userRole: (row.user_role ?? 'operator') as any,
  action: row.action,
  description: row.description,
  timestamp: row.created_at,
  ipAddress: row.ip_address ?? undefined,
});

export const mapFareRow = (row: any): FareConfig => ({
  baseFare: n(row.base_fare),
  pricePerKm: n(row.price_per_km),
  pricePerMinuteWait: n(row.price_per_minute_wait),
  nightSurchargePercent: n(row.night_surcharge_percent),
  sundaySurchargePercent: n(row.sunday_surcharge_percent),
  cancellationFee: n(row.cancellation_fee),
  currencySymbol: row.currency_symbol ?? '$',
});

export interface CommercialSnapshot {
  companies: Company[];
  vehicles: Vehicle[];
  drivers: Driver[];
  clients: Client[];
  trips: Trip[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  fareConfig: FareConfig | null;
}

export async function loadCommercialSnapshot(companyId: string, canSeeAllCompanies = false): Promise<CommercialSnapshot> {
  const db = requireSupabase();
  const companyQuery = canSeeAllCompanies
    ? db.from('companies').select('*').order('name')
    : db.from('companies').select('*').eq('id', companyId);

  const [companiesRes, vehiclesRes, driversRes, locationsRes, clientsRes, addressesRes, tripsRes, notificationsRes, auditRes, fareRes] = await Promise.all([
    companyQuery,
    db.from('vehicles').select('*').eq('company_id', companyId).is('archived_at', null).order('unit_number'),
    db.from('drivers').select('*').eq('company_id', companyId).is('archived_at', null).order('unit_number'),
    db.from('driver_locations').select('*').eq('company_id', companyId),
    db.from('clients').select('*').eq('company_id', companyId).order('name'),
    db.from('client_addresses').select('*').eq('company_id', companyId),
    db.from('trips').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1000),
    db.from('notifications').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(300),
    db.from('audit_logs').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(500),
    db.from('fare_configs').select('*').eq('company_id', companyId).maybeSingle(),
  ]);

  for (const result of [companiesRes, vehiclesRes, driversRes, locationsRes, clientsRes, addressesRes, tripsRes, notificationsRes, auditRes, fareRes]) {
    if (result.error) throw result.error;
  }

  const locations = new Map((locationsRes.data ?? []).map((row: any) => [row.driver_id, row]));
  const addressesByClient = new Map<string, any[]>();
  for (const address of addressesRes.data ?? []) {
    const list = addressesByClient.get((address as any).client_id) ?? [];
    list.push(address);
    addressesByClient.set((address as any).client_id, list);
  }

  return {
    companies: (companiesRes.data ?? []).map(mapCompanyRow),
    vehicles: (vehiclesRes.data ?? []).map(mapVehicleRow),
    drivers: (driversRes.data ?? []).map((row: any) => mapDriverRow(row, locations.get(row.id))),
    clients: (clientsRes.data ?? []).map((row: any) => mapClientRow(row, addressesByClient.get(row.id) ?? [])),
    trips: (tripsRes.data ?? []).map(mapTripRow),
    notifications: (notificationsRes.data ?? []).map(mapNotificationRow),
    auditLogs: (auditRes.data ?? []).map(mapAuditRow),
    fareConfig: fareRes.data ? mapFareRow(fareRes.data) : null,
  };
}

export async function insertTrip(company: Company, user: User, data: Partial<Trip>): Promise<Trip> {
  void user;
  const requestId = data.operatorRequestId ?? crypto.randomUUID();
  const { data: row, error } = await requireSupabase().rpc('centralgo_operator_create_trip', {
    p_company_id: company.id,
    p_operator_request_id: requestId,
    p_client_id: data.clientId ?? null,
    p_client_name: data.clientName || 'Cliente Particular',
    p_client_phone: data.clientPhone || 'Sin teléfono',
    p_origin_address: data.origin?.address || 'Origen sin dirección',
    p_origin_lat: data.origin?.lat ?? 0,
    p_origin_lng: data.origin?.lng ?? 0,
    p_origin_notes: data.origin?.notes ?? null,
    p_destination_address: data.destination?.address || 'A convenir',
    p_destination_lat: data.destination?.lat ?? data.origin?.lat ?? 0,
    p_destination_lng: data.destination?.lng ?? data.origin?.lng ?? 0,
    p_destination_notes: data.destination?.notes ?? null,
    p_driver_id: data.driverId ?? null,
    p_vehicle_type_requested: data.vehicleTypeRequested ?? 'standard',
    p_estimated_distance_km: data.estimatedDistanceKm ?? 0,
    p_estimated_duration_mins: data.estimatedDurationMins ?? 0,
    p_estimated_fare: data.isFixedFare && data.fixedFareAmount != null ? data.fixedFareAmount : (data.estimatedFare ?? 0),
    p_is_fixed_fare: Boolean(data.isFixedFare),
    p_fixed_fare_amount: data.fixedFareAmount ?? null,
    p_payment_method: data.paymentMethod ?? 'efectivo',
    p_notes: data.notes ?? null,
    p_scheduled_for: data.scheduledFor ?? null,
    p_dispatch_mode: data.driverId ? 'manual' : (data.dispatchMode ?? 'automatic'),
  });
  if (error) throw error;
  return mapTripRow(row);
}

export async function assignTripAtomic(tripId: string, driverId: string): Promise<Trip> {
  const { data, error } = await requireSupabase().rpc('centralgo_operator_assign_trip', { p_trip_id: tripId, p_driver_id: driverId });
  if (error) throw error;
  return mapTripRow(data);
}

export async function unassignTripAtomic(tripId: string, reason?: string): Promise<Trip> {
  const { data, error } = await requireSupabase().rpc('centralgo_operator_unassign_trip', { p_trip_id: tripId, p_reason: reason ?? null });
  if (error) throw error;
  return mapTripRow(data);
}

export async function rejectDriverTripAtomic(tripId: string, reason?: string): Promise<Trip> {
  const { data, error } = await requireSupabase().rpc('centralgo_driver_reject_trip', { p_trip_id: tripId, p_reason: reason ?? 'Rechazado por conductor' });
  if (error) throw error;
  return mapTripRow(data);
}

export async function cancelTripAtomic(tripId: string, reason: string): Promise<Trip> {
  const { data, error } = await requireSupabase().rpc('centralgo_operator_cancel_trip', { p_trip_id: tripId, p_reason: reason });
  if (error) throw error;
  return mapTripRow(data);
}

export async function setTripStatusAtomic(tripId: string, status: TripStatus, asDriver: boolean): Promise<Trip> {
  const rpc = asDriver ? 'centralgo_driver_transition_trip' : 'centralgo_operator_set_trip_status';
  const db = requireSupabase();
  const transition = () => db.rpc(rpc, { p_trip_id: tripId, p_new_status: status });
  const first = await transition();
  if (!first.error) return mapTripRow(first.data);
  if (!asDriver) throw first.error;

  const confirmed = await loadTripByIdSafe(tripId);
  if (confirmed && tripReachedStatus(confirmed.status, status)) return confirmed;
  if (!isTransientConnectionError(first.error)) throw first.error;

  try { await db.auth.refreshSession(); } catch { /* The existing session may still be usable. */ }
  await new Promise((resolve) => setTimeout(resolve, 350));
  const retry = await transition();
  if (!retry.error) return mapTripRow(retry.data);
  const recovered = await loadTripByIdSafe(tripId);
  if (recovered && tripReachedStatus(recovered.status, status)) return recovered;
  throw new Error('No pudimos confirmar el cambio por una conexión inestable. La app volverá a sincronizar el viaje automáticamente.');
}

const TRIP_PROGRESS: TripStatus[] = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed'];
const tripReachedStatus = (current: TripStatus, target: TripStatus) => {
  const currentIndex = TRIP_PROGRESS.indexOf(current);
  const targetIndex = TRIP_PROGRESS.indexOf(target);
  return current === target || (currentIndex >= 0 && targetIndex >= 0 && currentIndex >= targetIndex);
};
const isTransientConnectionError = (error: unknown) => /network|fetch|timeout|timed out|connection|load failed|failed to fetch/i.test(error instanceof Error ? error.message : String(error ?? ''));

export async function loadTripById(tripId: string): Promise<Trip | null> {
  const { data, error } = await requireSupabase().from('trips').select('*').eq('id', tripId).maybeSingle();
  if (error) throw error;
  return data ? mapTripRow(data) : null;
}

const loadTripByIdSafe = async (tripId: string) => {
  try { return await loadTripById(tripId); } catch { return null; }
};

export async function loadDriverVisibleTrips(companyId: string): Promise<Trip[]> {
  const { data, error } = await requireSupabase().from('trips').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(250);
  if (error) throw error;
  return (data ?? []).map(mapTripRow);
}

export async function completeTripAtomic(tripId: string, finalFare: number, paymentMethod: PaymentMethod): Promise<Trip> {
  const { data, error } = await requireSupabase().rpc('centralgo_complete_trip', {
    p_trip_id: tripId,
    p_final_fare: finalFare,
    p_payment_method: paymentMethod,
  });
  if (error) throw error;
  return mapTripRow(data);
}

export async function setDriverManualStatus(companyId: string, status: DriverStatus): Promise<void> {
  const { error } = await requireSupabase().rpc('centralgo_driver_set_manual_status', { target_company: companyId, new_status: status });
  if (error) throw error;
}

export async function setDriverStatusAsOperator(driverId: string, status: DriverStatus): Promise<void> {
  const { error } = await requireSupabase().rpc('centralgo_operator_set_driver_status', { p_driver_id: driverId, p_new_status: status });
  if (error) throw error;
}

export async function reportDriverLocation(companyId: string, lat: number, lng: number, address?: string): Promise<void> {
  const { error } = await requireSupabase().rpc('centralgo_driver_report_location', {
    target_company: companyId,
    p_lat: lat,
    p_lng: lng,
    p_address: address ?? null,
    p_speed_kmh: null,
    p_heading_degrees: null,
    p_accuracy_meters: null,
  });
  if (error) throw error;
}

export async function triggerDriverSos(driver: Driver): Promise<string> {
  const { data, error } = await requireSupabase().rpc('centralgo_driver_trigger_sos', {
    p_lat: driver.currentLocation.lat || null,
    p_lng: driver.currentLocation.lng || null,
    p_address: driver.currentLocation.address ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function resolveOwnDriverSos(): Promise<void> {
  const { error } = await requireSupabase().rpc('centralgo_driver_resolve_own_sos', { p_notes: 'Alerta desactivada por el conductor desde su PWA' });
  if (error) throw error;
}

export async function resolveDriverSos(driverId: string): Promise<void> {
  const db = requireSupabase();
  const { data: event, error: readError } = await db.from('sos_events').select('id').eq('driver_id', driverId).is('resolved_at', null).order('activated_at', { ascending: false }).limit(1).maybeSingle();
  if (readError) throw readError;
  if (!event) return;
  const { error } = await db.rpc('centralgo_operator_resolve_sos', { p_event_id: event.id, p_notes: null });
  if (error) throw error;
}

export async function settleDriverAtomic(driverId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('centralgo_admin_settle_driver', { p_driver_id: driverId, p_amount: null, p_notes: null });
  if (error) throw error;
}

export async function insertClient(data: Omit<Client, 'id' | 'totalTrips'>): Promise<Client> {
  const db = requireSupabase();
  const { data: row, error } = await db.from('clients').insert({
    company_id: data.companyId,
    name: data.name,
    phone: data.phone,
    email: data.email ?? null,
    rating: data.rating ?? 5,
    is_vip: data.isVIP,
    notes: data.notes ?? null,
    has_current_account: Boolean(data.hasCurrentAccount),
  }).select('*').single();
  if (error) throw error;
  if (data.frequentAddresses?.length) {
    const { error: addressError } = await db.from('client_addresses').insert(data.frequentAddresses.map((item) => ({ client_id: row.id, company_id: data.companyId, ...item })));
    if (addressError) throw addressError;
  }
  return mapClientRow(row, data.frequentAddresses ?? []);
}

const normalizeVehicleUnitNumber = (value: string) => value.trim().replace(/^m[oó]vil\s*/i, '').trim();

const vehiclePayload = (data: Omit<Vehicle, 'id'>) => ({
    company_id: data.companyId,
    unit_number: normalizeVehicleUnitNumber(data.unitNumber),
    license_plate: data.licensePlate.trim().toUpperCase(),
    brand: data.brand.trim(),
    model: data.model.trim(),
    year: data.year,
    color: data.color.trim(),
    capacity: data.capacity,
    pet_friendly: data.petFriendly,
    wheelchair_accessible: data.wheelchairAccessible,
    air_conditioning: data.airConditioning,
    technical_inspection_expiry: data.technicalInspectionExpiry || null,
    status: data.status,
});

const readableVehicleError = (error: unknown, unitNumber: string, licensePlate: string): Error => {
  const details = typeof error === 'object' && error ? error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown } : {};
  const code = typeof details.code === 'string' ? details.code : '';
  const message = typeof details.message === 'string' ? details.message : '';
  const constraint = `${message} ${typeof details.details === 'string' ? details.details : ''}`.toLowerCase();
  if (/^(El móvil|La patente|El número móvil|Ingresa )/i.test(message)) return new Error(message);
  if (code === '23505' && constraint.includes('unit_number')) return new Error(`El móvil ${unitNumber} ya está registrado en esta central.`);
  if (code === '23505' && constraint.includes('license_plate')) return new Error(`La patente ${licensePlate} ya está registrada en esta central.`);
  if (code === '23514' && message) return new Error(message);
  if (code === '42501') return new Error('Tu cuenta no tiene permiso para registrar vehículos en esta central.');
  console.error('Vehicle save failed', error);
  return new Error('No fue posible guardar el vehículo. Revisa los datos e inténtalo nuevamente.');
};

export async function insertVehicle(data: Omit<Vehicle, 'id'>): Promise<Vehicle> {
  const db = requireSupabase();
  const payload = vehiclePayload(data);
  const { data: row, error } = await db.rpc('centralgo_admin_save_vehicle', {
    p_company_id: payload.company_id,
    p_unit_number: payload.unit_number,
    p_license_plate: payload.license_plate,
    p_brand: payload.brand,
    p_model: payload.model,
    p_year: payload.year,
    p_color: payload.color,
    p_capacity: payload.capacity,
    p_pet_friendly: payload.pet_friendly,
    p_wheelchair_accessible: payload.wheelchair_accessible,
    p_air_conditioning: payload.air_conditioning,
    p_technical_inspection_expiry: payload.technical_inspection_expiry,
    p_status: payload.status,
  });
  if (error) throw readableVehicleError(error, payload.unit_number, payload.license_plate);
  if (!row) throw new Error('No fue posible confirmar el registro del vehículo.');
  return mapVehicleRow(row);
}

export async function updateVehicleRecord(vehicle: Vehicle): Promise<Vehicle> {
  const { data: row, error } = await requireSupabase().from('vehicles').update({
    unit_number: normalizeVehicleUnitNumber(vehicle.unitNumber),
    license_plate: vehicle.licensePlate.trim().toUpperCase(),
    brand: vehicle.brand.trim(),
    model: vehicle.model.trim(),
    year: vehicle.year,
    color: vehicle.color.trim(),
    capacity: vehicle.capacity,
    pet_friendly: vehicle.petFriendly,
    wheelchair_accessible: vehicle.wheelchairAccessible,
    air_conditioning: vehicle.airConditioning,
    technical_inspection_expiry: vehicle.technicalInspectionExpiry || null,
    status: vehicle.status,
  }).eq('id', vehicle.id).eq('company_id', vehicle.companyId).select('*').single();
  if (error) throw readableVehicleError(error, vehicle.unitNumber, vehicle.licensePlate);
  return mapVehicleRow(row);
}

export async function assignCompanyUserByEmail(companyId: string, email: string, role: 'company_admin' | 'operator' | 'driver'): Promise<string> {
  const { data, error } = await requireSupabase().rpc('centralgo_assign_company_user', { p_company_id: companyId, p_email: email.trim(), p_role: role });
  if (error) throw error;
  return String(data);
}

export async function insertDriver(data: Omit<Driver, 'id' | 'rating' | 'totalTripsCompleted' | 'todayEarnings'>): Promise<Driver> {
  const { data: row, error } = await requireSupabase().from('drivers').insert({
    company_id: data.companyId,
    user_id: data.userId || null,
    vehicle_id: data.vehicleId ?? null,
    unit_number: data.unitNumber,
    display_name: data.name,
    phone: data.phone,
    license_number: data.licenseNumber,
    license_expiry: data.licenseExpiry || null,
    photo_url: data.photoUrl || null,
    status: data.status,
    commission_balance: data.commissionBalance,
    sos_active: data.sosActive,
  }).select('*').single();
  if (error) throw error;
  return mapDriverRow(row);
}

export async function saveFareConfig(companyId: string, config: FareConfig): Promise<void> {
  const { error } = await requireSupabase().from('fare_configs').upsert({
    company_id: companyId,
    base_fare: config.baseFare,
    price_per_km: config.pricePerKm,
    price_per_minute_wait: config.pricePerMinuteWait,
    night_surcharge_percent: config.nightSurchargePercent,
    sunday_surcharge_percent: config.sundaySurchargePercent,
    cancellation_fee: config.cancellationFee,
    currency_symbol: config.currencySymbol,
  });
  if (error) throw error;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await requireSupabase().from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(companyId: string): Promise<void> {
  const { error } = await requireSupabase().from('notifications').update({ read: true }).eq('company_id', companyId).eq('read', false);
  if (error) throw error;
}

export async function insertNotification(companyId: string, title: string, message: string, type: AppNotification['type'], relatedId?: string): Promise<AppNotification> {
  const { data: row, error } = await requireSupabase().from('notifications').insert({ company_id: companyId, title, message, type, related_id: relatedId ?? null }).select('*').single();
  if (error) throw error;
  return mapNotificationRow(row);
}

export async function writeAudit(companyId: string, action: string, description: string): Promise<void> {
  const { error } = await requireSupabase().rpc('centralgo_write_audit', { target_company: companyId, p_action: action, p_description: description, p_metadata: {} });
  if (error) throw error;
}

export function subscribeCompanyRealtime(companyId: string, handlers: {
  onTrip: (trip: Trip) => void;
  onDriver: (driverRow: any) => void;
  onLocation: (locationRow: any) => void;
  onNotification: (notification: AppNotification) => void;
  onStatus?: (status: string) => void;
}) {
  const db = requireSupabase();
  const channel = db.channel(`centralgo:${companyId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `company_id=eq.${companyId}` }, (payload) => {
      if (payload.eventType !== 'DELETE') handlers.onTrip(mapTripRow(payload.new));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: `company_id=eq.${companyId}` }, (payload) => {
      if (payload.eventType !== 'DELETE') handlers.onDriver(payload.new);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: `company_id=eq.${companyId}` }, (payload) => {
      if (payload.eventType !== 'DELETE') handlers.onLocation(payload.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `company_id=eq.${companyId}` }, (payload) => {
      handlers.onNotification(mapNotificationRow(payload.new));
    })
    .subscribe((status) => handlers.onStatus?.(status));

  return () => { void db.removeChannel(channel); };
}
