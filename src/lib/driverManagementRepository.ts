import { requireSupabase } from './supabase';

export interface DriverProfileUpdateInput {
  driverId: string;
  companyId: string;
  vehicleId?: string;
  unitNumber: string;
  name: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
}

export async function updateDriverProfile(input: DriverProfileUpdateInput): Promise<void> {
  const db = requireSupabase();

  const { data: current, error: currentError } = await db
    .from('drivers')
    .select('id, company_id, vehicle_id, status')
    .eq('id', input.driverId)
    .eq('company_id', input.companyId)
    .maybeSingle();

  if (currentError) throw currentError;
  if (!current) throw new Error('No fue posible encontrar al conductor en esta central.');

  const nextVehicleId = input.vehicleId?.trim() || null;
  const vehicleChanged = (current.vehicle_id ?? null) !== nextVehicleId;

  if (vehicleChanged && ['en_route', 'in_trip', 'sos'].includes(String(current.status))) {
    throw new Error('No puedes cambiar el vehículo mientras el conductor está en una carrera activa o con SOS. Déjalo libre o fuera de servicio primero.');
  }

  if (nextVehicleId) {
    const { data: vehicle, error: vehicleError } = await db
      .from('vehicles')
      .select('id')
      .eq('id', nextVehicleId)
      .eq('company_id', input.companyId)
      .maybeSingle();

    if (vehicleError) throw vehicleError;
    if (!vehicle) throw new Error('El vehículo seleccionado no pertenece a esta central.');

    const { data: occupied, error: occupiedError } = await db
      .from('drivers')
      .select('id, display_name, unit_number')
      .eq('company_id', input.companyId)
      .eq('vehicle_id', nextVehicleId)
      .neq('id', input.driverId)
      .limit(1)
      .maybeSingle();

    if (occupiedError) throw occupiedError;
    if (occupied) {
      throw new Error(`Ese vehículo ya está asignado a ${occupied.unit_number || 'otro móvil'} (${occupied.display_name || 'otro conductor'}).`);
    }
  }

  const unitNumber = input.unitNumber.trim();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const licenseNumber = input.licenseNumber.trim();

  if (!unitNumber || !name || !phone || !licenseNumber) {
    throw new Error('Número de móvil, nombre, teléfono y licencia son obligatorios.');
  }

  const { error } = await db
    .from('drivers')
    .update({
      vehicle_id: nextVehicleId,
      unit_number: unitNumber,
      display_name: name,
      phone,
      license_number: licenseNumber,
      license_expiry: input.licenseExpiry || null,
    })
    .eq('id', input.driverId)
    .eq('company_id', input.companyId);

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ese número de móvil o número de licencia ya está registrado en esta central.');
    }
    throw error;
  }
}
