import { requireSupabase } from './supabase';

export type DispatchQueueDirection = 'up' | 'down';
export type DriverOperationMode = 'app' | 'traditional';

export interface DispatchQueueItem {
  driverId:string;companyId:string;userId:string;unitNumber:string;name:string;
  status:'available'|'en_route'|'in_trip'|'paused'|'offline'|'sos';serviceEnabled:boolean;operationMode:DriverOperationMode;
  queueOrder:number;queueUpdatedAt:string;presenceStartedAt:string|null;lat:number|null;lng:number|null;locationUpdatedAt:string|null;locationAddress:string;
  routeDistanceKm:number|null;routeDurationSeconds:number|null;routeProvider:string|null;routeComputedAt:string|null;presenceLastSeenAt:string|null;
}

export interface DriverQueueSnapshotItem {
  driverId:string;
  userId:string;
  unitNumber:string;
  status:DispatchQueueItem['status'];
  queueOrder:number;
  connectedAt:string;
  presenceLastSeenAt:string|null;
}

const APP_PRESENCE_MAX_AGE_MS=4.5*60*1000;
const FALLBACK_RECONCILE_MS=8000;
const isFresh=(timestamp:string|null,maxAgeMs:number)=>{if(!timestamp)return false;const ageMs=Date.now()-new Date(timestamp).getTime();return Number.isFinite(ageMs)&&ageMs>=-60*1000&&ageMs<=maxAgeMs;};
const queueTimestamp=(item:DispatchQueueItem)=>{const value=item.operationMode==='app'?item.presenceStartedAt:item.queueUpdatedAt;const parsed=value?new Date(value).getTime():Number.NaN;if(Number.isFinite(parsed))return parsed;const fallback=new Date(item.queueUpdatedAt).getTime();return Number.isFinite(fallback)?fallback:Number.MAX_SAFE_INTEGER;};

/**
 * Presentación FIFO real: el primer conductor conectado queda arriba y cada
 * conductor que abre una sesión después queda debajo. El orden interno de
 * despacho puede cambiar por carreras o ajustes del operador, pero no debe
 * reordenar visualmente la lista de conexión.
 */
export const sortDispatchQueueByConnection=(a:DispatchQueueItem,b:DispatchQueueItem)=>queueTimestamp(a)-queueTimestamp(b)||a.queueOrder-b.queueOrder||a.unitNumber.localeCompare(b.unitNumber,'es',{numeric:true});

/**
 * La fila y el mapa son dos señales distintas:
 * - la presencia mantiene al conductor dentro de la fila;
 * - el GPS, cuando existe, permite además ubicarlo en el mapa.
 * Así un móvil recién integrado no desaparece sólo porque todavía está tomando
 * la primera posición GPS o porque Android suspendió temporalmente el sensor.
 *
 * La ventana de presencia sigue el heartbeat real (1 min) y el corte de sesión
 * del backend (4 min). Evita móviles fantasma durante 20 minutos si la app se
 * cierra sin poder enviar el evento de desconexión.
 */
export const isQueueConnected=(item:DispatchQueueItem)=>{
  if(['offline','paused','sos'].includes(item.status)||!item.serviceEnabled)return false;
  if(item.operationMode==='traditional')return item.status==='available';
  return isFresh(item.presenceLastSeenAt,APP_PRESENCE_MAX_AGE_MS);
};

export async function loadDispatchQueue(companyId:string,tripId?:string):Promise<DispatchQueueItem[]>{
 const db=requireSupabase();
 const[driversResult,locationsResult,presenceResult,routeResult]=await Promise.all([
  db.from('drivers').select('id,company_id,user_id,unit_number,display_name,status,service_enabled,operation_mode,dispatch_queue_order,dispatch_queue_updated_at').eq('company_id',companyId).order('dispatch_queue_order',{ascending:true}),
  db.from('driver_locations').select('driver_id,lat,lng,address,recorded_at').eq('company_id',companyId),
  db.from('driver_presence_sessions').select('driver_id,started_at,last_seen_at,ended_at').eq('company_id',companyId).is('ended_at',null).order('started_at',{ascending:false}),
  tripId?db.rpc('centralgo_operator_route_metrics',{p_trip_id:tripId}):Promise.resolve({data:[],error:null} as any),
 ]);
 if(driversResult.error)throw driversResult.error;if(locationsResult.error)throw locationsResult.error;if(presenceResult.error)throw presenceResult.error;if(routeResult.error)throw routeResult.error;
 const locations=new Map((locationsResult.data??[]).map((row:any)=>[row.driver_id,row]));const presence=new Map<string,any>();for(const row of presenceResult.data??[])if(!presence.has(row.driver_id))presence.set(row.driver_id,row);const routes=new Map((routeResult.data??[]).map((row:any)=>[row.driver_id,row]));
 return (driversResult.data??[]).map((row:any)=>{const location=locations.get(row.id)as any,driverPresence=presence.get(row.id)as any,route=routes.get(row.id)as any;return{driverId:row.id,companyId:row.company_id,userId:row.user_id??'',unitNumber:row.unit_number,name:row.display_name,status:row.status,serviceEnabled:row.service_enabled??false,operationMode:row.operation_mode==='traditional'?'traditional':'app',queueOrder:Number(row.dispatch_queue_order??0),queueUpdatedAt:row.dispatch_queue_updated_at??new Date().toISOString(),presenceStartedAt:driverPresence?.started_at??null,lat:location?.lat==null?null:Number(location.lat),lng:location?.lng==null?null:Number(location.lng),locationUpdatedAt:location?.recorded_at??null,locationAddress:location?.address??'Sin ubicación GPS reportada',presenceLastSeenAt:driverPresence?.last_seen_at??null,routeDistanceKm:route?.distance_km==null?null:Number(route.distance_km),routeDurationSeconds:route?.duration_seconds==null?null:Number(route.duration_seconds),routeProvider:route?.provider??null,routeComputedAt:route?.computed_at??null} satisfies DispatchQueueItem;});
}

/**
 * Snapshot mínimo y seguro para la app del conductor. La RLS de `drivers`
 * intencionalmente oculta las filas de otros móviles; este RPC devuelve sólo
 * lo necesario para mostrar posición y cantidad de conectados de la central.
 */
export async function loadDriverQueueSnapshot(companyId:string):Promise<DriverQueueSnapshotItem[]>{
 const{data,error}=await requireSupabase().rpc('centralgo_driver_queue_snapshot',{target_company:companyId});
 if(error)throw error;
 return (data??[]).map((row:any)=>({
  driverId:String(row.driver_id),
  userId:row.user_id?String(row.user_id):'',
  unitNumber:String(row.unit_number??''),
  status:row.status as DriverQueueSnapshotItem['status'],
  queueOrder:Number(row.queue_order??0),
  connectedAt:String(row.connected_at??''),
  presenceLastSeenAt:row.presence_last_seen_at?String(row.presence_last_seen_at):null,
 }));
}

export async function refreshDispatchRouteMatrix(tripId:string){const{error}=await requireSupabase().rpc('centralgo_operator_refresh_route_matrix',{p_trip_id:tripId});if(error)throw error;}
export async function moveDispatchPriority(driverId:string,direction:DispatchQueueDirection){const{error}=await requireSupabase().rpc('centralgo_operator_move_driver_priority',{p_driver_id:driverId,p_direction:direction});if(error)throw error;}
export async function setDriverOperationMode(driverId:string,mode:DriverOperationMode){const{error}=await requireSupabase().rpc('centralgo_operator_set_driver_operation_mode',{p_driver_id:driverId,p_mode:mode});if(error)throw error;}
export async function setTraditionalDriverAvailability(driverId:string,available:boolean){const{error}=await requireSupabase().rpc('centralgo_operator_set_driver_daily_service',{p_driver_id:driverId,p_enabled:available,p_mode:'traditional'});if(error)throw error;}

/**
 * Realtime es la vía rápida. El sondeo visible de 8 s es deliberadamente un
 * cinturón de seguridad: una pestaña no puede quedar desactualizada
 * indefinidamente aunque RLS o una reconexión WebSocket oculten algún evento.
 */
export function subscribeDispatchQueue(companyId:string,onChange:()=>void){
 const db=requireSupabase();
 let timer:number|null=null;
 const schedule=()=>{if(timer!==null)window.clearTimeout(timer);timer=window.setTimeout(onChange,120);};
 const channel=db.channel(`centralgo-dispatch-priority:${companyId}`)
  .on('postgres_changes',{event:'*',schema:'public',table:'drivers',filter:`company_id=eq.${companyId}`},schedule)
  .on('postgres_changes',{event:'*',schema:'public',table:'driver_locations',filter:`company_id=eq.${companyId}`},schedule)
  .on('postgres_changes',{event:'*',schema:'public',table:'driver_presence_sessions',filter:`company_id=eq.${companyId}`},schedule)
  .subscribe(status=>{if(status==='SUBSCRIBED')schedule();});
 const reconcile=()=>{if(document.visibilityState==='visible'&&navigator.onLine)onChange();};
 const interval=window.setInterval(reconcile,FALLBACK_RECONCILE_MS);
 window.addEventListener('focus',reconcile);
 window.addEventListener('online',reconcile);
 return()=>{
  if(timer!==null)window.clearTimeout(timer);
  window.clearInterval(interval);
  window.removeEventListener('focus',reconcile);
  window.removeEventListener('online',reconcile);
  void db.removeChannel(channel);
 };
}
