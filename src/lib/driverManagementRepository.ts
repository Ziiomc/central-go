import { requireSupabase } from './supabase';

export interface DriverProfileUpdateInput {
  driverId:string;
  companyId:string;
  name:string;
  phone:string;
  address?:string;
  birthDate?:string;
  licenseNumber:string;
  licenseExpiry:string;
}

export async function updateDriverProfile(input:DriverProfileUpdateInput):Promise<void>{
 const db=requireSupabase();
 const{data:current,error:currentError}=await db.from('drivers').select('id, company_id').eq('id',input.driverId).eq('company_id',input.companyId).maybeSingle();
 if(currentError)throw currentError;
 if(!current)throw new Error('No fue posible encontrar al conductor en esta central.');

 const name=input.name.trim(),phone=input.phone.trim(),licenseNumber=input.licenseNumber.trim();
 if(!name||!phone||!licenseNumber)throw new Error('Nombre, teléfono y licencia son obligatorios.');

 const{error}=await db.from('drivers').update({
  display_name:name,
  phone,
  address:input.address?.trim()||null,
  birth_date:input.birthDate||null,
  license_number:licenseNumber,
  license_expiry:input.licenseExpiry||null,
 }).eq('id',input.driverId).eq('company_id',input.companyId);
 if(error){
  if(error.code==='23505')throw new Error('Ese número de licencia ya está registrado en esta central.');
  throw error;
 }
 window.dispatchEvent(new Event('centralgo:driver-resync'));
}

export async function assignDriverVehicle(driverId:string,companyId:string,vehicleId:string):Promise<{driverId:string;vehicleId:string;unitNumber:string}>{
 void companyId;
 if(!vehicleId.trim())throw new Error('Selecciona un móvil registrado.');
 const{data,error}=await requireSupabase().rpc('centralgo_operator_assign_driver_vehicle',{p_driver_id:driverId,p_vehicle_id:vehicleId});
 if(error)throw error;
 const row=(Array.isArray(data)?data[0]:data) as any;
 if(!row?.id)throw new Error('No fue posible confirmar la asignación del móvil.');
 window.dispatchEvent(new Event('centralgo:driver-resync'));
 return{driverId:String(row.id),vehicleId:String(row.vehicle_id||vehicleId),unitNumber:String(row.unit_number||'')};
}

export async function releaseDriverVehicle(driverId:string,companyId:string):Promise<void>{
 void companyId;
 const{data,error}=await requireSupabase().rpc('centralgo_operator_release_driver_vehicle',{p_driver_id:driverId});
 if(error)throw error;
 if(!data)throw new Error('No fue posible confirmar la liberación del móvil.');
 window.dispatchEvent(new Event('centralgo:driver-resync'));
}

export interface TraditionalDriverRegistrationInput {
  companyId:string;
  name:string;
  phone:string;
  address?:string;
  birthDate?:string;
  licenseNumber:string;
  licenseExpiry?:string;
}

export async function registerTraditionalDriver(input:TraditionalDriverRegistrationInput):Promise<{id:string;unitNumber:string;name:string}> {
 const {data,error}=await requireSupabase().rpc('centralgo_operator_register_manual_driver',{
  p_company_id:input.companyId,
  p_vehicle_id:null,
  p_unit_number:null,
  p_display_name:input.name.trim(),
  p_phone:input.phone.trim(),
  p_address:input.address?.trim()||null,
  p_birth_date:input.birthDate||null,
  p_license_number:input.licenseNumber.trim(),
  p_license_expiry:input.licenseExpiry||null,
 });
 if(error)throw error;
 const row=(Array.isArray(data)?data[0]:data) as any;
 return{id:String(row?.id||''),unitNumber:String(row?.unit_number||''),name:String(row?.display_name||input.name.trim())};
}
