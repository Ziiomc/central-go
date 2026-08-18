import { requireSupabase } from './supabase';
import type { Driver } from '../types';
export interface DriverAnalytics {connectedSeconds:number;drivingSeconds:number;serviceKm:number;tripsCompleted:number;earnings:number;avgTripSeconds:number;}
export async function sendDriverRadioMessage(companyId:string,driver:Driver,message:string):Promise<void>{
 if(!driver.userId)throw new Error('Este conductor todavía no tiene una cuenta profesional vinculada.');
 const clean=message.trim();if(!clean)throw new Error('Escribe un mensaje para el conductor.');
 const db=requireSupabase();const{error}=await db.from('notifications').insert({company_id:companyId,recipient_user_id:driver.userId,title:`RADIO CENTRAL · MÓVIL ${driver.unitNumber}`,message:clean,type:'warning',related_id:driver.id});if(error)throw error;
}
export async function sendDriverRadioBroadcast(companyId:string,drivers:Driver[],message:string):Promise<number>{
 const clean=message.trim();if(!clean)throw new Error('Escribe un mensaje para la flota.');
 const recipients=drivers.filter(driver=>driver.userId&&driver.status!=='offline');
 if(!recipients.length)throw new Error('No hay conductores conectados con una cuenta profesional vinculada.');
 const rows=recipients.map(driver=>({company_id:companyId,recipient_user_id:driver.userId!,title:'RADIO CENTRAL · MENSAJE GENERAL',message:clean,type:'warning',related_id:driver.id}));
 const{error}=await requireSupabase().from('notifications').insert(rows);if(error)throw error;return rows.length;
}
export async function sendDriverRadioToCentral(companyId:string,presetCode:string,message:string):Promise<string>{const clean=message.trim();if(!clean)throw new Error('Selecciona un mensaje para la central.');const{data,error}=await requireSupabase().rpc('centralgo_driver_send_radio',{target_company:companyId,p_message:clean,p_preset_code:presetCode});if(error)throw error;return String(data);}
export async function pingDriverPresence(companyId:string):Promise<void>{const{error}=await requireSupabase().rpc('centralgo_driver_presence_ping',{target_company:companyId});if(error)throw error;}
export async function endDriverPresence(companyId:string):Promise<void>{const{error}=await requireSupabase().rpc('centralgo_driver_presence_end',{target_company:companyId});if(error)throw error;}
export async function loadDriverAnalytics(companyId:string,from:Date,to:Date):Promise<DriverAnalytics>{const{data,error}=await requireSupabase().rpc('centralgo_driver_analytics',{target_company:companyId,p_from:from.toISOString(),p_to:to.toISOString()});if(error)throw error;return{connectedSeconds:Number(data?.connected_seconds??0),drivingSeconds:Number(data?.driving_seconds??0),serviceKm:Number(data?.gps_km??data?.service_km??0),tripsCompleted:Number(data?.trips_completed??0),earnings:Number(data?.earnings??0),avgTripSeconds:Number(data?.avg_trip_seconds??0)};}