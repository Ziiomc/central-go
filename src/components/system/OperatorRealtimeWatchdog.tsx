import React,{useEffect,useRef}from'react';
import{useApp}from'../../context/AppContext';
import{requireSupabase}from'../../lib/supabase';

type PulseTrip={id:string;status:string;driver_id:string|null};
const FALLBACK_RECONCILE_MS=12000;

/**
 * Realtime is the primary transport. This guard only reconciles missed websocket
 * events after sleep, a network handoff or a browser/PWA suspension.
 *
 * Keep this intentionally lightweight: polling every few seconds per operator
 * multiplies quickly when several companies are working at once. Focus/online
 * events still reconcile immediately, while the passive fallback runs at 12 s.
 */
export const OperatorRealtimeWatchdog:React.FC=()=>{
 const{currentCompany,currentRole,trips}=useApp();
 const tripsRef=useRef(trips);
 const lastRecoveryRef=useRef(0);
 const busyRef=useRef(false);

 useEffect(()=>{tripsRef.current=trips;},[trips]);

 useEffect(()=>{
  if(currentCompany.id==='network'||!['operator','company_admin'].includes(currentRole))return;
  let stopped=false;

  const reconcile=async()=>{
   if(stopped||busyRef.current||!navigator.onLine||document.visibilityState!=='visible')return;
   busyRef.current=true;
   try{
    const{data,error}=await requireSupabase().from('trips').select('id,status,driver_id').eq('company_id',currentCompany.id).order('created_at',{ascending:false}).limit(24);
    if(error)throw error;
    const local=new Map(tripsRef.current.map(trip=>[trip.id,trip]));
    const mismatch=(data as PulseTrip[]|null|undefined)?.some(row=>{
     const trip=local.get(row.id);
     return !trip||trip.status!==row.status||(trip.driverId??null)!==(row.driver_id??null);
    })??false;
    if(!mismatch)return;
    const now=Date.now();
    if(now-lastRecoveryRef.current<4000)return;
    lastRecoveryRef.current=now;
    window.dispatchEvent(new CustomEvent('centralgo:driver-resync',{detail:{reason:'operator-realtime-reconciliation'}}));
   }catch(error){console.warn('[Central GO] Reconciliación operativa pendiente',error);}
   finally{busyRef.current=false;}
  };

  const initial=window.setTimeout(()=>void reconcile(),2200);
  const interval=window.setInterval(()=>void reconcile(),FALLBACK_RECONCILE_MS);
  const visible=()=>{if(document.visibilityState==='visible')void reconcile();};
  const online=()=>void reconcile();
  window.addEventListener('focus',online);
  window.addEventListener('online',online);
  document.addEventListener('visibilitychange',visible);
  return()=>{stopped=true;window.clearTimeout(initial);window.clearInterval(interval);window.removeEventListener('focus',online);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visible);};
 },[currentCompany.id,currentRole]);

 return null;
};
