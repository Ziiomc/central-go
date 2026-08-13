import { requireSupabase } from './supabase';
import { mapTripRow } from './commercialRepository';
import type { CallLog, ClientDriverBlock, DriverComplaint, FareDestination, Trip, TripDispatchEvent } from '../types';

const PAGE_SIZE = 1000;

export interface TripHistoryFilters {
  from?: string;
  to?: string;
  driverId?: string;
  vehicleId?: string;
  search?: string;
  status?: string;
}

export async function loadTripHistory(companyId: string, filters: TripHistoryFilters = {}): Promise<Trip[]> {
  const db = requireSupabase();
  const all: any[] = [];
  let offset = 0;
  while (true) {
    let query = db.from('trips').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);
    if (filters.driverId) query = query.eq('driver_id', filters.driverId);
    if (filters.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE || all.length >= 25000) break;
    offset += PAGE_SIZE;
  }
  const term = filters.search?.trim().toLowerCase();
  return all.map(mapTripRow).filter((trip) => !term || [
    trip.code, trip.clientName, trip.clientPhone, trip.origin.address, trip.destination.address,
    trip.driverName ?? '', trip.driverUnitNumber ?? '', trip.vehiclePlate ?? '', trip.vehicleUnitNumber ?? '', trip.operatorName,
  ].join(' ').toLowerCase().includes(term));
}

export async function loadFareDestinations(companyId: string): Promise<FareDestination[]> {
  const { data, error } = await requireSupabase().from('fare_destinations').select('*').eq('company_id', companyId).order('name');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id:row.id, companyId:row.company_id, name:row.name, matchText:row.match_text, fareAmount:Number(row.fare_amount), active:Boolean(row.active), createdAt:row.created_at }));
}

export async function saveFareDestination(companyId: string, input: { id?:string; name:string; matchText:string; fareAmount:number; active?:boolean }): Promise<FareDestination> {
  const db = requireSupabase();
  const payload = { company_id:companyId, name:input.name.trim(), match_text:input.matchText.trim(), fare_amount:input.fareAmount, active:input.active ?? true, updated_at:new Date().toISOString() };
  const query = input.id ? db.from('fare_destinations').update(payload).eq('id', input.id).eq('company_id', companyId) : db.from('fare_destinations').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return { id:data.id, companyId:data.company_id, name:data.name, matchText:data.match_text, fareAmount:Number(data.fare_amount), active:Boolean(data.active), createdAt:data.created_at };
}

export async function deleteFareDestination(companyId: string, id: string): Promise<void> {
  const { error } = await requireSupabase().from('fare_destinations').delete().eq('id', id).eq('company_id', companyId);
  if (error) throw error;
}

export async function registerDriverComplaint(driverId:string, reason:string, tripId?:string, penalty=0.25): Promise<DriverComplaint> {
  const { data, error } = await requireSupabase().rpc('centralgo_register_driver_complaint', { p_driver_id:driverId, p_reason:reason, p_trip_id:tripId ?? null, p_penalty:penalty });
  if (error) throw error;
  return { id:data.id, companyId:data.company_id, driverId:data.driver_id, tripId:data.trip_id ?? undefined, reason:data.reason, penalty:Number(data.penalty), ratingBefore:Number(data.rating_before), ratingAfter:Number(data.rating_after), createdAt:data.created_at };
}

export async function loadDriverComplaints(companyId:string, driverId?:string): Promise<DriverComplaint[]> {
  let query = requireSupabase().from('driver_complaints').select('*').eq('company_id', companyId).order('created_at', { ascending:false });
  if (driverId) query = query.eq('driver_id', driverId);
  const { data, error } = await query.limit(1000);
  if (error) throw error;
  return (data ?? []).map((row:any)=>({ id:row.id, companyId:row.company_id, driverId:row.driver_id, tripId:row.trip_id ?? undefined, reason:row.reason, penalty:Number(row.penalty), ratingBefore:Number(row.rating_before), ratingAfter:Number(row.rating_after), createdAt:row.created_at }));
}

export async function setClientDriverBlock(clientId:string, driverId:string, reason:string, active=true): Promise<ClientDriverBlock> {
  const { data, error } = await requireSupabase().rpc('centralgo_set_client_driver_block', { p_client_id:clientId, p_driver_id:driverId, p_reason:reason, p_active:active });
  if (error) throw error;
  return { id:data.id, companyId:data.company_id, clientId:data.client_id, driverId:data.driver_id, reason:data.reason, active:Boolean(data.active), createdAt:data.created_at };
}

export async function loadClientDriverBlocks(companyId:string, clientId?:string): Promise<ClientDriverBlock[]> {
  let query = requireSupabase().from('client_driver_blocks').select('*').eq('company_id', companyId).eq('active', true).order('created_at', { ascending:false });
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row:any)=>({ id:row.id, companyId:row.company_id, clientId:row.client_id, driverId:row.driver_id, reason:row.reason, active:Boolean(row.active), createdAt:row.created_at }));
}

export async function addCallLog(companyId:string, input:{clientName?:string;phone:string;direction?:'incoming'|'outgoing';outcome?:CallLog['outcome'];notes?:string;tripId?:string}): Promise<CallLog> {
  const payload = { company_id:companyId, client_name:input.clientName?.trim() || null, phone:input.phone.trim(), direction:input.direction ?? 'incoming', outcome:input.outcome ?? 'pedido', notes:input.notes?.trim() || null, trip_id:input.tripId ?? null };
  const { data, error } = await requireSupabase().from('call_logs').insert(payload).select('*').single();
  if (error) throw error;
  return { id:data.id, companyId:data.company_id, operatorUserId:data.operator_user_id ?? undefined, clientName:data.client_name ?? undefined, phone:data.phone, direction:data.direction, outcome:data.outcome, notes:data.notes ?? undefined, tripId:data.trip_id ?? undefined, createdAt:data.created_at };
}

export async function loadCallLogs(companyId:string, from?:string, to?:string): Promise<CallLog[]> {
  let query = requireSupabase().from('call_logs').select('*').eq('company_id', companyId).order('created_at', { ascending:false }).limit(5000);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row:any)=>({ id:row.id, companyId:row.company_id, operatorUserId:row.operator_user_id ?? undefined, clientName:row.client_name ?? undefined, phone:row.phone, direction:row.direction, outcome:row.outcome, notes:row.notes ?? undefined, tripId:row.trip_id ?? undefined, createdAt:row.created_at }));
}

export async function loadDispatchEvents(companyId:string, driverId?:string, from?:string, to?:string): Promise<TripDispatchEvent[]> {
  let query = requireSupabase().from('trip_dispatch_events').select('*').eq('company_id', companyId).order('created_at', { ascending:false }).limit(5000);
  if (driverId) query = query.eq('driver_id', driverId);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lt('created_at', to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row:any)=>({ id:row.id, companyId:row.company_id, tripId:row.trip_id, driverId:row.driver_id ?? undefined, eventType:row.event_type, reason:row.reason ?? undefined, createdAt:row.created_at }));
}

export interface CompanyDriverMetric {driverId:string;name:string;unitNumber:string;connectedSeconds:number;drivingSeconds:number;tripsCompleted:number;offers:number;rejected:number;cancelled:number;earnings:number;serviceKm:number;effectiveness:number;}

export async function loadCompanyShiftAnalytics(companyId:string,from:string,to:string):Promise<{trips:Trip[];events:TripDispatchEvent[];drivers:CompanyDriverMetric[]}> {
 const db=requireSupabase();
 const[trips,events,driverResult,presenceResult]=await Promise.all([
  loadTripHistory(companyId,{from,to}),
  loadDispatchEvents(companyId,undefined,from,to),
  db.from('drivers').select('id,name,unit_number').eq('company_id',companyId).order('unit_number'),
  db.from('driver_presence_sessions').select('driver_id,started_at,last_seen_at,ended_at').eq('company_id',companyId).lt('started_at',to).limit(10000),
 ]);
 if(driverResult.error)throw driverResult.error;if(presenceResult.error)throw presenceResult.error;
 const fromMs=new Date(from).getTime(),toMs=new Date(to).getTime();
 const metrics=(driverResult.data??[]).map((row:any)=>{
  const ownTrips=trips.filter(t=>t.driverId===row.id),ownEvents=events.filter(e=>e.driverId===row.id);
  const connectedSeconds=(presenceResult.data??[]).filter((s:any)=>s.driver_id===row.id).reduce((sum:number,s:any)=>{const start=Math.max(fromMs,new Date(s.started_at).getTime());const rawEnd=s.ended_at??s.last_seen_at;const end=Math.min(toMs,new Date(rawEnd).getTime());return sum+Math.max(0,(end-start)/1000);},0);
  const completed=ownTrips.filter(t=>t.status==='completed'&&t.completedAt&&new Date(t.completedAt).getTime()>=fromMs&&new Date(t.completedAt).getTime()<toMs);
  const drivingSeconds=ownTrips.reduce((sum,t)=>{if(!t.startedAt)return sum;const start=Math.max(fromMs,new Date(t.startedAt).getTime());const end=Math.min(toMs,new Date(t.completedAt??t.cancelledAt??to).getTime());return sum+Math.max(0,(end-start)/1000);},0);
  const rejected=ownEvents.filter(e=>e.eventType==='rejected'||e.eventType==='expired').length,cancelled=ownTrips.filter(t=>t.status==='cancelled').length,offers=ownEvents.filter(e=>e.eventType==='offered').length;
  const opportunities=Math.max(offers,completed.length+rejected+cancelled);
  return{driverId:row.id,name:row.name,unitNumber:row.unit_number,connectedSeconds:Math.round(connectedSeconds),drivingSeconds:Math.round(drivingSeconds),tripsCompleted:completed.length,offers,rejected,cancelled,earnings:completed.reduce((s,t)=>s+(t.finalFare??t.estimatedFare??0),0),serviceKm:completed.reduce((s,t)=>s+t.estimatedDistanceKm,0),effectiveness:opportunities?Math.round(completed.length/opportunities*100):0};
 });
 return{trips,events,drivers:metrics};
}
