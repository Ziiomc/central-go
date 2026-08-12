import { requireSupabase } from './supabase';
import { mapTripRow } from './commercialRepository';
import type { Trip } from '../types';

const PAGE_SIZE=1000;
export interface HistoryFilters{from?:string;to?:string;driverId?:string;vehicleId?:string;status?:string;search?:string;}

export async function loadOperationalTripHistory(companyId:string,filters:HistoryFilters={}):Promise<Trip[]>{
 const db=requireSupabase(); const rows:any[]=[]; let offset=0;
 while(true){
  let q=db.from('trips').select('*').eq('company_id',companyId).order('created_at',{ascending:false}).range(offset,offset+PAGE_SIZE-1);
  if(filters.from)q=q.gte('created_at',filters.from); if(filters.to)q=q.lte('created_at',filters.to);
  if(filters.driverId)q=q.eq('driver_id',filters.driverId); if(filters.vehicleId)q=q.eq('vehicle_id',filters.vehicleId);
  if(filters.status&&filters.status!=='all')q=q.eq('status',filters.status);
  const{data,error}=await q;if(error)throw error;const page=data??[];rows.push(...page);if(page.length<PAGE_SIZE||rows.length>=25000)break;offset+=PAGE_SIZE;
 }
 const term=filters.search?.trim().toLowerCase();
 return rows.map((row:any)=>({
  ...mapTripRow(row),vehicleId:row.vehicle_id??undefined,vehicleUnitNumber:row.vehicle_unit_number??undefined,vehiclePlate:row.vehicle_plate??undefined,cancelSource:row.cancel_source??undefined,
 })).filter((t:Trip)=>!term||[t.code,t.clientName,t.clientPhone,t.origin.address,t.destination.address,t.driverName??'',t.driverUnitNumber??'',t.vehiclePlate??'',t.vehicleUnitNumber??'',t.operatorName].join(' ').toLowerCase().includes(term));
}

export async function loadDriverExtended(companyId:string){
 const{data,error}=await requireSupabase().from('drivers').select('id,address,birth_date,complaint_count,dispatch_priority_credit,rating').eq('company_id',companyId);if(error)throw error;
 return Object.fromEntries((data??[]).map((r:any)=>[r.id,{address:r.address??'',birthDate:r.birth_date??'',complaintCount:Number(r.complaint_count??0),dispatchPriorityCredit:Number(r.dispatch_priority_credit??0),rating:Number(r.rating??5)}]));
}

export async function saveDriverExtended(companyId:string,driverId:string,input:{address?:string;birthDate?:string}){
 const{error}=await requireSupabase().from('drivers').update({address:input.address?.trim()||null,birth_date:input.birthDate||null}).eq('company_id',companyId).eq('id',driverId);if(error)throw error;
}

export async function cancelTripWithSource(tripId:string,reason:string,source:'client'|'operator'){
 const{data,error}=await requireSupabase().rpc('centralgo_operator_cancel_trip_v2',{p_trip_id:tripId,p_reason:reason,p_source:source});if(error)throw error;return data;
}
