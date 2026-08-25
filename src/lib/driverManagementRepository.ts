import { requireSupabase } from './supabase';

export interface DriverProfileUpdateInput {
  driverId:string; companyId:string; vehicleId?:string; unitNumber:string; name:string; phone:string;
  address?:string; birthDate?:string; licenseNumber:string; licenseExpiry:string;
}

export async function updateDriverProfile(input:DriverProfileUpdateInput):Promise<void>{
 const db=requireSupabase();
 const{data:current,error:currentError}=await db.from('drivers').select('id, company_id, vehicle_id, status').eq('id',input.driverId).eq('company_id',input.companyId).maybeSingle();
 if(currentError)throw currentError;if(!current)throw new Error('No fue posible encontrar al conductor en esta central.');
 const nextVehicleId=input.vehicleId?.trim()||null;const vehicleChanged=(current.vehicle_id??null)!==nextVehicleId;
 if(vehicleChanged&&['en_route','in_trip','sos'].includes(String(current.status)))throw new Error('No puedes cambiar el vehículo mientras el conductor está en una carrera activa o con SOS. Déjalo libre o fuera de servicio primero.');
 if(nextVehicleId){
  const{data:vehicle,error:vehicleError}=await db.from('vehicles').select('id').eq('id',nextVehicleId).eq('company_id',input.companyId).maybeSingle();if(vehicleError)throw vehicleError;if(!vehicle)throw new Error('El vehículo seleccionado no pertenece a esta central.');
  const{data:occupied,error:occupiedError}=await db.from('drivers').select('id, display_name, unit_number').eq('company_id',input.companyId).eq('vehicle_id',nextVehicleId).neq('id',input.driverId).limit(1).maybeSingle();if(occupiedError)throw occupiedError;if(occupied)throw new Error(`Ese vehículo ya está asignado a ${occupied.unit_number||'otro móvil'} (${occupied.display_name||'otro conductor'}).`);
 }
 const unitNumber=input.unitNumber.trim(),name=input.name.trim(),phone=input.phone.trim(),licenseNumber=input.licenseNumber.trim();
 if(!unitNumber||!name||!phone||!licenseNumber)throw new Error('Número de móvil, nombre, teléfono y licencia son obligatorios.');
 const{error}=await db.from('drivers').update({vehicle_id:nextVehicleId,unit_number:unitNumber,display_name:name,phone,address:input.address?.trim()||null,birth_date:input.birthDate||null,license_number:licenseNumber,license_expiry:input.licenseExpiry||null}).eq('id',input.driverId).eq('company_id',input.companyId);
 if(error){if(error.code==='23505')throw new Error('Ese número de móvil o número de licencia ya está registrado en esta central.');throw error;}
}

export async function releaseDriverVehicle(driverId:string,companyId:string):Promise<void>{
 const db=requireSupabase();
 const{data:current,error:currentError}=await db.from('drivers').select('id, vehicle_id, status').eq('id',driverId).eq('company_id',companyId).maybeSingle();
 if(currentError)throw currentError;
 if(!current)throw new Error('No fue posible encontrar al conductor en esta central.');
 if(!current.vehicle_id)return;
 if(['en_route','in_trip','sos'].includes(String(current.status)))throw new Error('No puedes liberar el vehículo mientras el conductor está en una carrera activa o con SOS. Déjalo libre o fuera de servicio primero.');
 const{error}=await db.from('drivers').update({vehicle_id:null}).eq('id',driverId).eq('company_id',companyId);
 if(error)throw error;
 window.dispatchEvent(new Event('centralgo:driver-resync'));
}

export interface TraditionalDriverRegistrationInput {
  companyId:string; vehicleId?:string; unitNumber:string; name:string; phone:string;
  address?:string; birthDate?:string; licenseNumber:string; licenseExpiry?:string;
}

export async function registerTraditionalDriver(input:TraditionalDriverRegistrationInput):Promise<{id:string;unitNumber:string;name:string}> {
 const {data,error}=await requireSupabase().rpc('centralgo_operator_register_manual_driver',{
  p_company_id:input.companyId,
  p_vehicle_id:input.vehicleId?.trim()||null,
  p_unit_number:input.unitNumber.trim(),
  p_display_name:input.name.trim(),
  p_phone:input.phone.trim(),
  p_address:input.address?.trim()||null,
  p_birth_date:input.birthDate||null,
  p_license_number:input.licenseNumber.trim(),
  p_license_expiry:input.licenseExpiry||null,
 });
 if(error)throw error;
 const row=(Array.isArray(data)?data[0]:data) as any;
 return {id:String(row?.id||''),unitNumber:String(row?.unit_number||input.unitNumber.trim()),name:String(row?.display_name||input.name.trim())};
}