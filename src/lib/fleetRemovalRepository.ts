import { requireSupabase } from './supabase';

export interface RemovedDriverResult {
  ok: boolean;
  driverId: string;
  unitNumber: string;
  name: string;
  archived: boolean;
}

export interface RemovedVehicleResult {
  ok: boolean;
  vehicleId: string;
  unitNumber: string;
  licensePlate: string;
  archived: boolean;
}

export async function removeCompanyDriver(driverId: string): Promise<RemovedDriverResult> {
  const { data, error } = await requireSupabase().rpc('centralgo_company_remove_driver', { p_driver_id: driverId });
  if (error) throw error;
  window.dispatchEvent(new Event('centralgo:driver-resync'));
  return data as RemovedDriverResult;
}

export async function removeCompanyVehicle(vehicleId: string): Promise<RemovedVehicleResult> {
  const { data, error } = await requireSupabase().rpc('centralgo_company_remove_vehicle', { p_vehicle_id: vehicleId });
  if (error) throw error;
  window.dispatchEvent(new Event('centralgo:driver-resync'));
  return data as RemovedVehicleResult;
}
